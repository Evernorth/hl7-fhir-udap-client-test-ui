'use strict'
const udapClient = require('hl7-fhir-udap-client')
const express = require('express')
const config = require('config')
const fs = require('fs')
const app = express()
const session = require('express-session')
const hbs = require('hbs')
const axios = require('axios')
const { request } = require('http')

app.use('/static', express.static('public'))
app.use(express.urlencoded());
app.set('views', './views')
app.set('view engine', 'hbs')
app.set('trust proxy', 1) // trust first proxy
var sessionSecret = config.get("sessionSecret")
app.use(session({
    secret: sessionSecret,
    resave: true,
    saveUninitialized: true
}))
//hbs.localsAsTemplateData(app);

hbs.registerHelper('breaklines', function (text) {
    if (typeof (text) != 'undefined') {
        text = new hbs.handlebars.SafeString(text);
        text = text.toString();
        text = text.replace(/(\r\n|\n|\r)/gm, '<br>');
    }
    return new hbs.handlebars.escapeExpression(text);
})

//Ignore self signed cert error
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

//Load up our config.
const port = config.get("server.port")
const host = config.get("server.host")
const organizationId = config.get("udapclient.organizationId")
const organizationName = config.get("udapclient.organizationName")
const purposeOfUse = config.get("udapclient.purposeOfUse")
const privateKeyFilename = config.get("udapclient.privateKeyFile")
const privateKeyPassword = config.get("udapclient.privateKeyPassword")
const trustAnchorFilename = config.get("udapclient.trustAnchorFile")
const clientContact = config.get("udapclient.clientContact")
const udapServerFile = config.get("udapclient.udapServerFile")
const ccSubjectAltName = config.get("udapclient.ccSan")
const authCodeSubjectAltName = config.get("udapclient.authCodeSan")
const redirectUrl = "http://" + host + ":" + port + "/callback"
const logouri = config.get("udapclient.logouri")
var udapServerConfig = {}
const clientName = config.get("udapclient.clientName")
//Needed for hbs template
var udapServers = []
var udapServer = {}
var newUdapServer = {}
var ccUdapClient = null
var authCodeUdapClient = null
var mustAddServer = false



const ccRegistrationObject = {
    client_name: clientName + " UDAP Client Credentials Flow",
    response_types: ['token'],
    contacts: [clientContact],
    logo_uri: '',
    scope: '',
    san: ccSubjectAltName
}

const authCodeRegistrationObject = {
    client_name: clientName + " UDAP Auth Code Flow",
    contacts: [clientContact],
    response_types: ['code'],
    redirect_uris: [redirectUrl],
    logo_uri: logouri,
    scope: '',
    san: authCodeSubjectAltName
}
/*
Registration config:
client_name
grant_types
response_types
contacts
logouri
scope
redirect_uris
*/

async function registration(registrationObject, req, udapClient) {
    try {
        const udapDCRResponse = await udapClient.udapDynamicClientRegistration(registrationObject)
        console.debug(udapDCRResponse)
        if (udapDCRResponse.status == 201 || udapDCRResponse.status == 200) {
            req.session.registrationError = ""
            return udapDCRResponse.data
        }
        else {
            req.session.registrationError = { "Error Code: ": udapDCRResponse.statusCode, "Error Message": udapDCRResponse.body }
        }
    }
    catch (e) {
        console.error(e)
        throw e
    }
}

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('-');
}

//Finds selected server in in array from file and returns it
function findSelectedServer(udapServers, selectedServerName) {
    var udapServer = {}
    if (udapServers != null) {
        udapServers.forEach(function (server) {
            if (server.name == selectedServerName) {
                udapServer.name = server.name
                udapServer.serverBaseUrl = server.serverBaseUrl
                udapServer.ccScopes = server.ccScopes
                udapServer.ccClientId = server.ccClientId
                udapServer.authCodeScopes = server.authCodeScopes
                udapServer.authCodeClientId = server.authCodeClientId
                udapServer.selected = true
            }
        })
    }
    return udapServer
}

function updateServerFile(udapServers, selectedServer) {
    updateSelectedServer(udapServers, selectedServer)
    udapServerConfig.selectedServerName = selectedServer.name
    udapServerConfig.udapServers = udapServers
    fs.writeFileSync(udapServerFile, JSON.stringify(udapServerConfig));
}

//Finds selected server in the array originally from config file and updates it using selectedServer object
//If the server is not found it adds it to the array
function updateSelectedServer(udapServers, selectedServer) {
    var found = false
    if (udapServers.length != 0) {
        udapServers.forEach(function (server) {
            if (server.name == selectedServer.name) {
                found = true
                populateServer(server,selectedServer)
            }
            else {
                server.selected = false
            }
        })
    }
    else {
        var server = {}
        populateServer(server,selectedServer)
    }
    if (!found) {
        udapServers.push(selectedServer)
    }
}

function populateServer(server,selectedServer){
    server.name = selectedServer.name
    server.serverBaseUrl = selectedServer.serverBaseUrl
    server.ccScopes = selectedServer.ccScopes
    server.ccClientId = selectedServer.ccClientId
    server.authCodeScopes = selectedServer.authCodeScopes
    server.authCodeClientId = selectedServer.authCodeClientId
    server.selected = true
}

//Convenience method for instantiate object and get and validate metadata so it is cached in the client object
async function getUdapClientAndMetaData(privateKeyFilename, privateKeyPassword, trustAnchorFilename, clientId, serverBaseUrl, organizationId, organizationName, purposeOfUse)
{
    var newUdapClient = new udapClient(privateKeyFilename, privateKeyPassword, trustAnchorFilename, clientId, serverBaseUrl, organizationId, organizationName, purposeOfUse)
    await newUdapClient.getAndValidateUdapMetadata(newUdapClient.udapWellknownUrl)
    if (newUdapClient.udapWellKnownMetadata.udap_profiles_supported.includes("udap_to"))
    {
        udapServer.supportsTieredOAuth = true
    } else
    {
        udapServer.supportsTieredOAuth = false
    }
    return newUdapClient
}

//Application endpoints
app.get('/', (req, res) => {
    res.render('index', {
        clientName: clientName,
        ccToken: req.session.ccToken,
        authCodeToken: req.session.authCodeToken,
        registrationError: req.session.registrationError,
        ccTokenError: req.session.ccTokenError,
        authCodeTokenError: req.session.authCodeTokenError,
        udapServer: udapServer,
        udapServers: udapServers,
        newUdapServer: newUdapServer,
        addServerError: req.session.addServerError,
        mustAddServer : mustAddServer
    })
})

app.post('/', async (req, res) => {
    var patientQueryResponse = ""
    var patientSearchResponse = ""
    var patientMatchResponse = ""
    if (req.body.action != null) {
        if (req.body.action == 'getB2bToken') {
            try {
                if (ccUdapClient == null) {
                    ccUdapClient = await getUdapClientAndMetaData(privateKeyFilename, privateKeyPassword, trustAnchorFilename, udapServer.ccClientId, udapServer.serverBaseUrl, organizationId, organizationName, purposeOfUse)
                }
                var tokenResponse = await ccUdapClient.udapTokenRequestClientCredentials(udapServer.ccScopes)
                req.session.ccToken = tokenResponse.data.access_token
                req.session.ccTokenError = ""
            }
            catch (e) {
                console.error(e)
                req.session.ccTokenError = e.code + ' - ' + e.message
            }

        }
        else if (req.body.action == 'getB2cToken') {
            try {
                if (authCodeUdapClient == null) {
                    authCodeUdapClient = await getUdapClientAndMetaData(privateKeyFilename, privateKeyPassword, trustAnchorFilename, udapServer.authCodeClientId, udapServer.serverBaseUrl, organizationId, organizationName, purposeOfUse)
                }
                var authorizeData = await authCodeUdapClient.udapAuthorizeRequest(req.body.idpUrl, udapServer.authCodeScopes, redirectUrl)
                console.debug("Authorize Data: ")
                console.debug(authorizeData)
                req.session.authz_state = authorizeData.state
                res.redirect(authorizeData.authorizeUrl)
            }
            catch (e) {
                console.error(e)
                req.session.ccTokenError = e.message
            }
        }
        else if (req.body.action == 'clearSession') {
            req.session.destroy()
        }
        else if (req.body.action == 'patientQuery') {
            var accessToken = ""
            if (req.body.tokenToUse == 'cc') {
                accessToken = req.session.ccToken
            }
            else {
                accessToken = req.session.authCodeToken
            }
            //Run our FHIR query here!
            var resource = req.body.resourceToGet
            console.debug("Resource: " + resource)
            console.debug("Patient id: " + req.body.patientId)
            var patientUrl = ""
            if (resource == 'Patient') {
                patientUrl = udapServer.serverBaseUrl + '/Patient/' + req.body.patientId
            }
            else {
                patientUrl = udapServer.serverBaseUrl + '/' + resource + '?patient=' + req.body.patientId
            }
            console.debug("Invoking FHIR URL: " + patientUrl)
            const patientQueryResults = await axios.request({
                'url': patientUrl,
                'method': 'GET',
                'headers': { 'Authorization': 'Bearer ' + accessToken },
                'validateStatus': () => true,
            })
            console.debug("Response Code: " + patientQueryResults.status)
            patientQueryResponse = "StatusCode: " + patientQueryResults.status + "\n"
            patientQueryResponse += "Body: " + JSON.stringify(patientQueryResults.data)
        }
        else if (req.body.action == 'patientSearch') {
            var accessToken = ""
            if (req.body.tokenToUse == 'cc') {
                accessToken = req.session.ccToken
            }
            else {
                accessToken = req.session.authCodeToken
            }
            var formattedDob = formatDate(Date.parse(req.body.dob))
            //Run our FHIR query here!
            const patientSearchUrl = udapServer.serverBaseUrl + '/Patient?birthdate=' + formattedDob + '&family=' + req.body.familyName + "&given=" + req.body.givenName
            console.debug("Invoking FHIR URL: " + patientSearchUrl)
            const patientSearchResults = await axios.request({
                'url': patientSearchUrl,
                'method': 'GET',
                'headers': { 'Authorization': 'Bearer ' + accessToken },
                'validateStatus': () => true,
            })
            patientSearchResponse = "StatusCode: " + patientSearchResults.status + "\n"
            patientSearchResponse += "Body: " + JSON.stringify(patientSearchResults.data)
        }
        else if (req.body.action == 'patientMatch') {
            var accessToken = ""
            if (req.body.tokenToUse == 'cc') {
                accessToken = req.session.ccToken
            }
            else {
                accessToken = req.session.authCodeToken
            }
            //Run our FHIR query here!
            const patientMatchUrl = udapServer.serverBaseUrl + '/Patient/$match'
            console.debug("Invoking FHIR URL: " + patientMatchUrl)
            var formattedDob = formatDate(Date.parse(req.body.dob))
            const jsonData = {
                "resourceType": "Parameters",
                "id": "evernorthclient99999",
                "meta": {
                    "lastUpdated": Date.now().toString()
                },
                "parameter": [
                    {
                        "name": "resource",
                        "resource": {
                            "resourceType": "Patient",
                            "meta": {
                                "profile": [
                                    "http://hl7.org/fhir/us/identity-matching/StructureDefinition/IDI-Patient"
                                ]
                            },
                            "name": [
                                {
                                    "family": req.body.familyName,
                                    "given": [
                                        req.body.givenName
                                    ]
                                }
                            ],
                            "birthDate": formattedDob,
                            "gender": req.body.gender,
                            "telecom": [
                                {
                                    "system": "phone",
                                    "value": req.body.phone
                                }
                            ]
                        }
                    },
                    {
                        "name": "count",
                        "valueInteger": "3"
                    },
                    {
                        "name": "onlyCertainMatches",
                        "valueBoolean": "false"
                    }
                ]
            }
            //TODO: Remove before production
            //Logging a request with PII/PHI should only be done if log target is encrypted/secured
            console.debug("JSON Match Request: " + JSON.stringify(jsonData))
            const patientMatchResults = await axios.request({
                'url': patientMatchUrl,
                'method': 'POST',
                'headers': {
                    'Authorization': 'Bearer ' + accessToken,
                    'Content-Type': 'application/json'
                },
                'data': jsonData,
                'validateStatus': () => true,
            })
            console.debug("Response Code: " + patientMatchResults.status)
            patientMatchResponse = "StatusCode: " + patientMatchResults.status + "\n"
            patientMatchResponse += "Body: " + JSON.stringify(patientMatchResults.data)
        }
    }
    else if (req.body.dropDownServerSelect != null) {
        udapServer = findSelectedServer(udapServers, req.body.dropDownServerSelect)
        updateServerFile(udapServers, udapServer)
        //new server clear appropriate session variables
        req.session.ccToken = ""
        req.session.authCodeToken = ""
        req.session.ccTokenError = ""
        req.session.authCodeTokenError = ""
        req.session.registrationError = ""
        req.session.addServerError = ""
        //Instantiate new clients for this server
        ccUdapClient = await getUdapClientAndMetaData(privateKeyFilename, privateKeyPassword, trustAnchorFilename, udapServer.ccClientId, udapServer.serverBaseUrl, organizationId, organizationName, purposeOfUse)
        authCodeUdapClient = await getUdapClientAndMetaData(privateKeyFilename, privateKeyPassword, trustAnchorFilename, udapServer.authCodeClientId, udapServer.serverBaseUrl, organizationId, organizationName, purposeOfUse)
    }
    //Ugly hack to ensure that if we're redirecting, let's not try to render the page.
    if (req.body.action != 'getB2cToken') {
        res.render('index', {
            clientName: clientName,
            ccToken: req.body.action == 'clearSession' ? "" : req.session.ccToken,
            authCodeToken: req.body.action == 'clearSession' ? "" : req.session.authCodeToken,
            queryResponse: patientQueryResponse,
            matchResponse: patientMatchResponse,
            patientSearchResponse: patientSearchResponse,
            registrationError: req.body.action == 'clearSession' ? "" : JSON.stringify(req.session.registrationError),
            ccTokenError: req.body.action == 'clearSession' ? "" : JSON.stringify(req.session.ccTokenError),
            authCodeTokenError: req.body.action == 'clearSession' ? "" : JSON.stringify(req.session.authCodeTokenError),
            udapServer: udapServer,
            udapServers: udapServers,
            mustAddServer : mustAddServer,
            addServerError: req.session.addServerError
        })
    }
})

//Application endpoints
app.get('/callback', async (req, res) => {
    if (req.query.state == req.session.authz_state) {
        var tokenResponse = await authCodeUdapClient.udapTokenRequestAuthCode(req.query.code, redirectUrl)
        req.session.authCodeToken = tokenResponse.data.access_token
        res.redirect("/")
    }
    else {
        res.send("An invalid authorization code state was sent.")
    }
})

app.post('/clientreg',async(req,res) => {
    if (ccUdapClient == null && req.body.regToPerform =='cc') {
        try {
            ccUdapClient = getUdapClientAndMataData(privateKeyFilename, privateKeyPassword, trustAnchorFilename, '', udapServer.serverBaseUrl, organizationId, organizationName, purposeOfUse)
        } catch (error) {
            req.session.registrationError = "Client Credentials Client Metadata Error:\r\n" + e.message
        }
    }
    if (ccUdapClient.udapWellKnownMetadata.grant_types_supported.includes("client_credentials") && req.body.regToPerform =='cc') {
        console.log("Server supports client_credentials.  Registering with FHIR server.")
        var regReturn
        try {
            ccRegistrationObject.scope = udapServer.ccScopes,
            ccRegistrationObject.grant_types= ['client_credentials']
            regReturn = await registration(ccRegistrationObject, req, ccUdapClient)
            udapServer.ccClientId = regReturn.client_id
            udapServer.ccScopes = regReturn.scope
            //Update client id after successful registration
            ccUdapClient.clientId = regReturn.client_id
            updateServerFile(udapServerConfig.udapServers, udapServer)
        }
        catch (e) {
            req.session.registrationError = "Client Credentials Registration Error:\r\n" + e.message
        }
        res.redirect("/")
    }
    if (authCodeUdapClient == null && req.body.regToPerform =='authCode') {
        try {
            authCodeUdapClient = await getUdapClientAndMetaData(privateKeyFilename, privateKeyPassword, trustAnchorFilename, '', udapServer.serverBaseUrl, organizationId, organizationName, purposeOfUse)
        }
        catch (error) {
            req.session.registrationError = "Auth Code Flow Metadata Error:\r\n" + e.message
        }
        res.redirect("/")
    }
    if (authCodeUdapClient.udapWellKnownMetadata.grant_types_supported.includes("authorization_code") && req.body.regToPerform =='authCode') {

        var regReturn
        try {
            console.log("Server supports authorization_code.  Registering with FHIR server.")
            authCodeRegistrationObject.scope = udapServer.authCodeScopes
            authCodeRegistrationObject.grant_types = ['authorization_code']
            regReturn = await registration(authCodeRegistrationObject, req, authCodeUdapClient)
            udapServer.authCodeClientId = regReturn.client_id
            udapServer.authCodeScopes = regReturn.scope
            //Update client id after successful registration
            authCodeUdapClient.clientId = regReturn.client_id
            updateServerFile(udapServerConfig.udapServers, udapServer)
        }
        catch (e) {
            req.session.registrationError = req.session.registrationError + "\r\nAuth Code Flow Registration Error:\r\n" + e.message
        }
        res.redirect("/")
    }
})

app.post('/delclientreg', async(req,res) => {
    if (ccUdapClient != null && req.body.regToPerform =='cc') 
    {
        var regReturn
        try {
            ccRegistrationObject.scope = udapServer.ccScopes,
            ccRegistrationObject.grant_types = [];
            regReturn = await registration(ccRegistrationObject, req, ccUdapClient)
            if (regReturn.grant_types.length == 0)
            {   
                //Update client id after successful registration
                ccUdapClient.clientId = ''
                udapServer.ccClientId = ''
                updateServerFile(udapServerConfig.udapServers, udapServer)
            }
        }
        catch (e) {
            req.session.registrationError = "Delete Client Credentials Registration Error:\r\n" + e.message
        }
        res.redirect("/")
    }
    else if (authCodeUdapClient != null && req.body.regToPerform =='authCode') 
    {
        var regReturn
        try {
            authCodeRegistrationObject.scope = udapServer.authCodeScopes,
            authCodeRegistrationObject.grant_types = [];
            regReturn = await registration(authCodeRegistrationObject, req, authCodeUdapClient)
            if (regReturn.grant_types.length == 0)
            {   
                //Update client id after successful registration
                authCodeUdapClient.clientId = ''
                udapServer.authCodeClientId = ''
                updateServerFile(udapServerConfig.udapServers, udapServer)
            }
        }
        catch (e) {
            req.session.registrationError = "Delete Auth Code Flow Registration Error:\r\n" + e.message
        }
        res.redirect("/")
    }
})

app.post('/getmetadata', async (req, res) => {
    if (req.body.action.includes('getMetaData')) {
        if (req.body.serverBaseUrl != '') {
            var udapClientMetaData = new udapClient(privateKeyFilename, privateKeyPassword, trustAnchorFilename, '', req.body.serverBaseUrl, organizationId, organizationName, purposeOfUse)
            try {
                await udapClientMetaData.getAndValidateUdapMetadata(udapClientMetaData.udapWellknownUrl)
                newUdapServer.name = req.body.serverName
                newUdapServer.serverBaseUrl = req.body.serverBaseUrl
                newUdapServer.ccScopes = udapClientMetaData.udapWellKnownMetadata.scopes_supported.toString().replaceAll(",", " ")
                newUdapServer.authCodeScopes = udapClientMetaData.udapWellKnownMetadata.scopes_supported.toString().replaceAll(",", " ")
                res.redirect("/")
            }
            catch (udapClientError) {
                req.session.addServerError = udapClientError.code + " - " + udapClientError.message
                res.redirect("/")
            }

        }
    }
})

app.post('/saveserver', async (req, res) => {
    if (req.body.action.includes('saveServer')) {
        try {
            //TODO:  Can remove this once client side validation is in
            if (req.body.servername != '') {
                console.log("Saving new server")
                udapServer.name = req.body.serverName
                udapServer.serverBaseUrl = req.body.serverBaseUrl
                udapServer.ccScopes = req.body.ccScopes
                udapServer.authCodeScopes = req.body.authCodeScopes
                udapServer.ccClientId = ""
                udapServer.authCodeClientId = ""
                udapServer.selected = true
                updateServerFile(udapServers, udapServer)
                newUdapServer = {}
                //Instantiate new clients for this server
                ccUdapClient = await getUdapClientAndMetaData(privateKeyFilename, privateKeyPassword, trustAnchorFilename, udapServer.ccClientId, udapServer.serverBaseUrl, organizationId, organizationName, purposeOfUse)
                authCodeUdapClient = await getUdapClientAndMetaData(privateKeyFilename, privateKeyPassword, trustAnchorFilename, udapServer.authCodeClientId, udapServer.serverBaseUrl, organizationId, organizationName, purposeOfUse)       
                mustAddServer = false
                res.redirect("/")
            }
        }
        catch (e) {
            req.session.addServerError = "Error adding server: " + e.message
        }
    }
})

app.listen(port, async () => {
    //Load udapServer file
    console.log("Initializing app...")
    if (fs.existsSync(udapServerFile)) {
        udapServerConfig = JSON.parse(fs.readFileSync(udapServerFile))
        udapServers = udapServerConfig.udapServers
        udapServer = findSelectedServer(udapServers, udapServerConfig.selectedServerName)
        //Instantiate new clients for this server
        ccUdapClient = await getUdapClientAndMetaData(privateKeyFilename, privateKeyPassword, trustAnchorFilename, udapServer.ccClientId, udapServer.serverBaseUrl, organizationId, organizationName, purposeOfUse)
        authCodeUdapClient = await getUdapClientAndMetaData(privateKeyFilename, privateKeyPassword, trustAnchorFilename, udapServer.authCodeClientId, udapServer.serverBaseUrl, organizationId, organizationName, purposeOfUse)       
        mustAddServer = false
    }
    else{
        mustAddServer = true
    }
    console.log(`Example UDAP app listening on port ${port}`)
})