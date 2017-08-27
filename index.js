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
const boundary = 'boundary-koffee';

const params = {
    LexiconNames: [],
    OutputFormat: 'mp3',
    SampleRate: '16000',
    Text: 'What is one plus one?',
    TextType: 'text',
    VoiceId: 'Joanna',
};

function order() {
    const jsonData = fs.readFileSync(path.resolve(__dirname, '.token.json'));
    const { token } = JSON.parse(jsonData);
    const tempDirectory = path.resolve(__dirname, '.tmp');
    const filePath = fileName => path.resolve(tempDirectory, fileName);

    // Create a temporary working directory
    if (!fs.existsSync(tempDirectory)){
        fs.mkdirSync(tempDirectory);
    }

    // Convert text to speech
    synthesizeSpeech(params).flatMap((data) => {
        fs.writeFileSync(filePath('polly.mp3'), data.AudioStream);
        // Convert audio to avs accepted format
        return execListener([
            `sox ${filePath('polly.mp3')}`,
            '-c 1 -r 16000 -e signed -b 16',
            `${filePath('avs_request.wav')}`,
        ].join(' '));
    }).flatMap(() => {
        // Make the request to avs
        return execListener([
            'curl -i -k',
            `-H "Authorization: Bearer ${token}"`,
            '-F "metadata=<metadata.json;type=application/json; charset=UTF-8"',
            `-F "audio=<${filePath('avs_request.wav')};type=audio/L16; rate=16000; channels=1"`,
            `-o ${filePath('avs_response.txt')}`,
            'https://access-alexa-na.amazon.com/v1/avs/speechrecognizer/recognize',
        ].join(' '));
    }).subscribe(() => {
        const response = fs.readFileSync(filePath('avs_response.txt'));
        const parsedMessage = httpMessageParser(response);
        const multipart = parsedMessage.multipart[1];
        fs.writeFileSync(filePath('avs_response.mp3'), multipart.body);
    }, error => console.error);

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
