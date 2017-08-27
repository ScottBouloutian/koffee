const AWS = require('aws-sdk');
const { Observable } = require('rxjs');
const axios = require('axios');
const auth = require('./auth');
const path = require('path');
const fs = require('fs');
const httpMessageParser = require('http-message-parser');
const { exec } = require('child_process');
const speech = require('@google-cloud/speech');
const storage = require('@google-cloud/storage');

//const bucketName = process.env.KOFFEE_GOOGLE_BUCKET;
const bucketName = 'scottbouloutian-dev';

AWS.config.update({ region: 'us-east-1' });

const polly = new AWS.Polly();
const synthesizeSpeech = Observable.bindNodeCallback((...args) => polly.synthesizeSpeech(...args));
const execListener = Observable.bindNodeCallback(exec);
const speechClient = speech({
    projectId: 'koffee-178115',
    keyFilename: path.resolve(__dirname, 'google.json'),
});
const storageClient = storage({
    projectId: 'koffee-178115',
    keyFilename: path.resolve(__dirname, 'google.json'),
});

function uploadSpeech(filePath) {
    const bucket = storageClient.bucket(bucketName);
    const upload = Observable.bindNodeCallback((...args) => bucket.upload(...args));
    return upload(filePath);
}

function recognizeSpeech() {
    console.log('recognizing speech');
    const request = {
        config: {
            languageCode: 'en-US',
            sampleRateHertz: 16000,
            encoding: speech.v1.types.RecognitionConfig.AudioEncoding.LINEAR16,
        },
        audio: {
            uri: `gs://${bucketName}/avs_response.mp3`,
        },
    };
    return speechClient.recognize(request).then(console.log, console.error);
}

function order() {
    const jsonData = fs.readFileSync(path.resolve(__dirname, '.token.json'));
    const { token } = JSON.parse(jsonData);
    const tempDirectory = path.resolve(__dirname, '.tmp');
    const filePath = fileName => path.resolve(tempDirectory, fileName);

    // Create a temporary working directory
    if (!fs.existsSync(tempDirectory)) {
        fs.mkdirSync(tempDirectory);
    }

    // Convert text to speech
    const params = {
        LexiconNames: [],
        OutputFormat: 'mp3',
        SampleRate: '16000',
        Text: 'What is one plus one?',
        TextType: 'text',
        VoiceId: 'Joanna',
    };
    synthesizeSpeech(params)
        .flatMap((data) => {
            fs.writeFileSync(filePath('polly.mp3'), data.AudioStream);
            // Convert audio to avs accepted format
            return execListener([
                'sox',
                filePath('polly.mp3'),
                '-c 1 -r 16000 -e signed -b 16',
                filePath('avs_request.wav'),
            ].join(' '));
        })
        .flatMap(() => (
            execListener([
                'curl -i -k',
                `-H "Authorization: Bearer ${token}"`,
                '-F "metadata=<metadata.json;type=application/json; charset=UTF-8"',
                `-F "audio=<${filePath('avs_request.wav')};type=audio/L16; rate=16000; channels=1"`,
                `-o ${filePath('avs_response.txt')}`,
                'https://access-alexa-na.amazon.com/v1/avs/speechrecognizer/recognize',
            ].join(' '))
        ))
        .flatMap(() => {
            const response = fs.readFileSync(filePath('avs_response.txt'));
            const parsedMessage = httpMessageParser(response);
            const multipart = parsedMessage.multipart[1];
            fs.writeFileSync(filePath('avs_response.mp3'), multipart.body);
            return execListener([
                'sox',
                filePath('avs_response.mp3'),
                filePath('avs_response.flac'),
            ].join(' '));
        })
        .flatMap(() => uploadSpeech(filePath('avs_response.wav')))
        .flatMap(() => recognizeSpeech())
        .subscribe((response) => {
            console.log(response);
            console.log('done');
        }, error => console.log, () => {
            console.log('all complete');
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
