const AWS = require('aws-sdk');
const { Observable } = require('rxjs');
const axios = require('axios');
const auth = require('./auth');
const path = require('path');
const fs = require('fs');
const httpMessageParser = require('http-message-parser');
const { exec } = require('child_process');

AWS.config.update({ region: 'us-east-1' });

const polly = new AWS.Polly();
const synthesizeSpeech = Observable.bindNodeCallback((...args) => polly.synthesizeSpeech(...args));
const execListener = Observable.bindNodeCallback(exec);
const jsonData = fs.readFileSync(path.resolve(__dirname, '.token.json'));
const { token } = JSON.parse(jsonData);
const boundary = 'boundary-koffee';

const params = {
    LexiconNames: [],
    OutputFormat: 'mp3',
    SampleRate: '16000',
    Text: 'What is one plus one?',
    TextType: 'text',
    VoiceId: 'Joanna',
};

const BOUNDARY = 'BOUNDARY1234';
const BOUNDARY_DASHES = '--';
const NEWLINE = '\r\n';
const METADATA_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="metadata"';
const METADATA_CONTENT_TYPE = 'Content-Type: application/json; charset=UTF-8';
const AUDIO_CONTENT_TYPE = 'Content-Type: audio/L16; rate=16000; channels=1';
const AUDIO_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="audio"';
const metadata = {
    messageHeader: { },
    messageBody: {
        profile: 'alexa-close-talk',
        locale: 'en-us',
        format: 'audio/L16; rate=16000; channels=1',
    },
};
const postDataStart = [
    NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE, METADATA_CONTENT_DISPOSITION, NEWLINE,
    METADATA_CONTENT_TYPE, NEWLINE, NEWLINE, JSON.stringify(metadata), NEWLINE, BOUNDARY_DASHES,
    BOUNDARY, NEWLINE, AUDIO_CONTENT_DISPOSITION, NEWLINE, AUDIO_CONTENT_TYPE, NEWLINE, NEWLINE,
].join('');
const postDataEnd = [NEWLINE, BOUNDARY_DASHES, BOUNDARY, BOUNDARY_DASHES, NEWLINE].join('');

function order() {
    synthesizeSpeech(params).flatMap((data) => {
        fs.writeFileSync('polly.mp3', data.AudioStream);
        return execListener('sox polly.mp3 -c 1 -r 16000 -e signed -b 16 avs_request.wav');
    }).flatMap(() => {
        const uri = 'https://access-alexa-na.amazon.com/v1/avs/speechrecognizer/recognize';
        const start = new Buffer(postDataStart);
        const end = new Buffer(postDataEnd);
        const audio = fs.readFileSync(path.resolve(__dirname, 'avs_request.wav'));
        const buffer = Buffer.concat([start, audio, end]);
        return axios.post(uri, buffer, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`,
            },
        });
    }).subscribe((response) => {
        console.log(response.status);
        const parsedMessage = httpMessageParser(response.data);
        const audio = parsedMessage.multipart[1].body;
        fs.writeFileSync('avs_response.mp3', audio);
    }, error => {
        console.log(error.message);
        console.log(error.response);
    });
}

const args = process.argv.slice(2);
switch (args[0]) {
case 'auth':
    auth.login();
    break;
case 'order':
    order();
    break;
default:
    console.log('Try typing auth or order');
}
