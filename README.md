# hl7-fhir-udap-test-client-ui

## Overview

This nodejs/express/handlebars user interface project represents a user interface/test harness for a full UDAP (Unified Data Access Profiles) Client implementation. The user interface is part of a four-repository collection for a full [UDAP](https://www.udap.org/) implementation. The implementation adheres to published Version 1.0 of the [HL7 UDAP Security Implementation Guide](https://hl7.org/fhir/us/udap-security).

The client side components of the following features of the IG are supported:
- [UDAP trusted dynamic client registration](https://hl7.org/fhir/us/udap-security/registration.html)
- [B2B Authorization](https://hl7.org/fhir/us/udap-security/b2b.html)
- [B2C Authorization](https://hl7.org/fhir/us/udap-security/consumer.html)
- [Tiered OAuth](https://hl7.org/fhir/us/udap-security/user.html)

The user interface supports the UDAP version of OAuth2 Client Credentials Flow and Authorization Code Flow. Throughout the user interface (and code base), they are referred to as B2B (Client Credentials Flow) and B2C (Authorization Code Flow).

Links to the other repositories in the collection:
- [hl7-fhir-udap-common](https://github.com/Evernorth/hl7-fhir-udap-common#readme)
- [hl7-fhir-udap-client](https://github.com/Evernorth/hl7-fhir-udap-client#readme)
- [hl7-fhir-udap-server](https://github.com/Evernorth/hl7-fhir-udap-server#readme)

## Getting Started

[UDAP](https://www.udap.org/) is a trust community protocol built on top of Oauth (Open Authorization) 2.0 and OIDC (OpenID Connect).   It combines PKI (Public Key Infrastructure) with Oauth and OIDC to provide the trust community protocol.  The specific trust community has a CA (Certificate Authority) or multiple CA's, that issue X.509 certificates to all members of the community.  To be clear these are not the same as SSL certificates that can be obtained by proving ownership of a domain.  These are issued out of band with after proofing the identity of the organization obtaining the certificate.

The public and private keys contained in the X.509 certificate are used to provide the signing keys and verifying keys for JWT's (JSON Web Token).  The X.509 certificates are contained in the header of the JWT's moving the authentication mechanism to the application layer.

TODO: Diagram of repo relationship/description of to build a client, to build a server, etc.

## Client User Interface
![Client User Interface](./doc/ClientUIFull.png)

## User Interface UDAP Features
The following features are supported by the user interface:

**Add Servers**: The user interface supports adding different UDAP servers so the client can connect with multiple different servers in the community.
![Add Server Screen](./doc/AddServer.png)

**UDAP trusted dynamic client registration**: When a new server is added the next step is to have the client register with that server.  Using the Register Client button, the client is triggered to use UDAP trusted dynamic client registration to dynamically get a client id for that server. The registration is executed twice, once for Authorization Code Flow (B2C Registration) and once for Client Credentials Flow (B2B Registration). If a client id already exists, an "edit registration" is performed.

**UDAP B2B Authorization**: This supports the UDAP version of OAuth2 Client Credentials Flow for obtaining an access token. It is trigged by clicking the Get Token button in the B2B Token section of the user interface.

**UDAP B2C Authorization**: This supports the UDAP version of OAuth2 Authorization Code Flow for authenticating and obtaining an access token. It is triggered by clicking the Get Token button in the B2C Token section of the user interface.

**UDAP Tiered OAuth**: This supports the [Tiered OAuth](https://hl7.org/fhir/us/udap-security/user.html) flow, where the client passes in a preferred OpenID Connect Identity Provider (IDP) that the client wishes to user for user authentication. This is triggerd by populating the Upstream IDP URL text box in the B2C Token section of the user interface and then clicking the Get Token button in the same section. The Upstream IDP URL box will be disabled if the currently selected server does not support Tiered OAuth.

## User Interface FHIR Features

**FHIR Request**: This section supports issuing various FHIR resource get requests using a patient identifier. The resources currently supported are Patient, Allergy, Condition, and Medication. The resources are selected by using the resource radio buttons in the FHIR Request section of the user interface. The requests can be issued using either the B2B or B2C token by using the token radio button in the same section. The request is triggerd by clicking the Get Patient Data button.

**FHIR Patient Search**: This section supports issuing a FHIR search on the Patient resource using the text boxes. The request can be issued using either the B2B or B2C token by using the token radio button in the same section. The request is triggerd by clicking the Get Patient Search button.

**FHIR Patient $match**: This section supports issuing a post FHIR patient $match operation request. There are radio buttons to select the IDI Patient profile used in the request as defined here [Patient Weighted Input Information](http://hl7.org/fhir/us/identity-matching/2022May/patient-matching.html#patient-weighted-input-information). The request can be issued using either the B2B or B2C token by using the token radio button in the same section. The request is triggerd by clicking the Post Patient Match button.

## Usage

To use the user interface, you must have the following pre-requisites:

- [hl7-fhir-udap-common](https://github.com/Evernorth/hl7-fhir-udap-common#readme)
- [hl7-fhir-udap-client](https://github.com/Evernorth/hl7-fhir-udap-client#readme)
- Node.js
- At least one base URL of the UDAP secured FHIR server you are going to use
- The client will need a trust community certificate for at least one trust community.  The certificate and community trust anchor will need to be placed in the udap_pki folder.

## Installation

The repositories are currently set up for local installation. Placing all four repositories under the same parent folder will allow the package.json local file references to be resolved accurately. This repository will eventually be an npm package. 

### Step 1- Clone needed UDAP repositories
- [hl7-fhir-udap-common](https://github.com/Evernorth/hl7-fhir-udap-common#readme)
- [hl7-fhir-udap-client](https://github.com/Evernorth/hl7-fhir-udap-client#readme)

### Step 2- Install dependencies
```
npm install
```

### Step 3- Configure default.json file
Fill in all the fields in the config/default.json file. You will need to place your community certificate and trust anchor file in the udap_pki folder.

### Step 4- Run the app
Run the user interface locally.
```
node app.js
```

After you run the app, the first thing you will be presented with is the Add Server screen.  


## Getting Help

If you have questions, concerns, bug reports, etc., file an issue in this repository's Issue Tracker.

## Getting Involved

See the [CONTRIBUTING.md](CONTRIBUTING.md) file for info on how to get involved.

## License

The hl7-fhir-udap-test-client is Open Source Software released under the [Apache 2.0 license](https://www.apache.org/licenses/LICENSE-2.0.html).

## Original Contributors

The hl7-fhir-udap-client was originally developed as a collaborative effort between [Evernorth](https://www.evernorth.com/) and [Okta](https://www.okta.com/). We would like to recognize the following people for their initial contributions to the project: 
 - Tom Loomis, Evernorth
 - Dan Cinnamon, Okta