const url = require('url');
const http = require('http');
const axios = require('axios');
const opn = require('opn');
const fs = require('fs');
const path = require('path');

// const clientId = process.env.KOFFEE_CLIENT_ID;
// const clientSecret = process.env.KOFFEE_CLIENT_SECRET;
// const productId = process.env.KOFFEE_PRODUCT_ID;
// const deviceId = process.env.KOFFEE_DEVICE_ID;

const clientId = 'amzn1.application-oa2-client.07229ccdcc3945bea66b5dd44d985513';
const clientSecret = 'b2f663ae7a971b7ab3b1b7e97df3377825e823ed336c6806cc316699e60e9a97';
const productId = 'Koffee';
const deviceId = 'com.scottbouloutian.koffee';
const randomString = Math.random().toString();
const port = 3000;
const redirectUri = `http://localhost:${port}/callback`;

// Format the authentication url
const loginPath = url.format({
    protocol: 'https',
    host: 'www.amazon.com',
    pathname: 'ap/oa',
    query: {
        client_id: clientId,
        scope: 'alexa:all',
        scope_data: JSON.stringify({
            'alexa:all': {
                productID: productId,
                productInstanceAttributes: {
                    deviceSerialNumber: deviceId,
                },
            },
        }),
        response_type: 'code',
        redirect_uri: redirectUri,
        state: randomString,
    },
});

const auth = {
    login() {
        // Start the server to accept the redirect
        const server = http.createServer((req, resp) => {
            const urlObject = url.parse(req.url, true);
            const { query, pathname } = urlObject;
            switch (pathname) {
            case '/':
                resp.writeHead(302, {
                    Location: loginPath,
                });
                resp.end();
                break;
            case '/callback':
                if (query.state !== randomString) {
                    resp.end('Cross site forgery checking failed');
                    break;
                }
                axios.post('https://api.amazon.com/auth/o2/token', {
                    grant_type: 'authorization_code',
                    code: query.code,
                    client_id: clientId,
                    client_secret: clientSecret,
                    redirect_uri: redirectUri,
                }).then((response) => {
                    if (response.status !== 200) {
                        resp.end(`Error code ${response.status}`);
                    }
                    const token = response.data.access_token;
                    const data = JSON.stringify({ token });
                    fs.writeFileSync(path.resolve(__dirname, '.token.json'), data);
                    resp.end('Done, you may close this page');
                    server.close();
                    process.exit();
                }).catch(error => resp.end(error.message));
                break;
            default:
                resp.end('Invalid pathname');
            }
        }).listen(port);
        opn(`http://localhost:${port}`);
    },
};
module.exports = auth;
