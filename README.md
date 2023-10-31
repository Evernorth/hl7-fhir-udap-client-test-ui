# hl7-fhir-udap-client-ui

## Overview

This is nodejs, express user interface project that represents a client user interface for a full UDAP Client implementation.   The user interface is part of a 4 repository collection for a full [UDAP](https://www.udap.org/) implementation.   The implementation adheres to the published version 1.0 of the [HL7 UDAP Security Implementation Guide](https://hl7.org/fhir/us/udap-security).   This user interface implements a udapClient class.  The constructor takes in the following attributes:
- communityKeystoreFilename:  The PCKS#12 file (.p12).  Contains public and private keys for trust community
- communityKeystorePassword: Password to the PCKS#12 file
- trustAnchorFilename: Trust community trust anchor in PEM format
- clientId:  client Id for the associated UDAP server this instance is connecting to.  Optional if client has not registered with server yet pass in ""
- serverBaseUrl: Base FHIR url for the server this client instance is connecting to.

The following are defined in Defined in [B2B Authorizaion Extension Object](https://hl7.org/fhir/us/udap-security/b2b.html#b2b-authorization-extension-object)

- organizationId:  Unique identifier for the ogranization represented by this udap client instance
- organizationName:  String representation of the organization represented by this udap client instance
- purposeOfUse: The purpose for which the data requested will be used

## Public Instance Methods
The client class has methods to handle UDAP Trusted Dynamic Client Registration, UDAP Authorization Code Flow, UDAP Client Credentials Flow, as well as caching and validating UDAP Meta data.

- udapDynamicClientRegistration(registrationConfiguration): This method is used to execute a dynamic client registration request with a UDAP-capable authorization server.

- udapAuthorizeRequest(upstreamIdpUrl, scope, redirectUri): This is a helper method to generate an /authorize request that a client will redirect the user to. 

- udapTokenRequestClientCredentials(scope): This method is used in a B2B/Client credentials flow to invoke the authorization server's /token endpoint to obtain an access token. It uses the private key as defined in the communityKeystoreFilename constructor argument to sign the JWT used to authenticate with the authorization server.

- udapTokenRequestAuthCode(authCode, redirectUri): This method is used in a B2C/Authorization Code flow to invoke the authorization server's /token endpoint to obtain an id/access/refresh token. It uses the private key as defined in the communityKeystoreFilename constructor argument to sign the JWT used to authenticate with the authorization server.

- getAndValidateUdapMetadata(url): This method will retrieve the meta data for the url if it has not already been retreived for this instance.  It will also validate the meta data components to the [HL7 UDAP Security Implementation Guide](https://hl7.org/fhir/us/udap-security).

## Usage

To see example code you can browse the [hl7-fhir-udap-client-ui](https://github.com/Evernorth/hl7-fhir-udap-client-ui#readme) and [hl7-fhir-udap-server](https://github.com/Evernorth/hl7-fhir-udap-server#readme) repositories.

## Installation

Currently the repositories are set up for local installation.  Placing all 4 repositories under the same parent folder will allow the package.json local file references to be resolved accurately.  Eventually this repository will be an npm package.

## Getting help

If you have questions, concerns, bug reports, etc, please file an issue in this repository's Issue Tracker.

## Getting involved

Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for info on how to get involved.

## License

hl7-fhir-udap-client is Open Source Software released under the [Apache 2.0 license](https://www.apache.org/licenses/LICENSE-2.0.html).

## Original Contributors

The hl7-fhir-udap-client was developed originally as a collaborative effort between [Evernorth](https://www.evernorth.com/) and [Okta](https://www.okta.com/).  We would like to recognize the following people for their initial contributions to the project: 
 - Tom Loomis - Evernorth
 - Dan Cinnamon - Okta