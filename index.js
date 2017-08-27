const Promise = require('bluebird');
const AWS = require('aws-sdk');
const { Observable } = require('rxjs');
const auth = require('./auth');
const path = require('path');
const fs = require('fs');
const httpMessageParser = require('http-message-parser');
const { exec } = Promise.promisifyAll(require('child_process'));
const speech = require('@google-cloud/speech');
const storage = require('@google-cloud/storage');

//const bucketName = process.env.KOFFEE_GOOGLE_BUCKET;
const bucketName = 'scottbouloutian-dev';

AWS.config.update({ region: 'us-east-1' });

const polly = new AWS.Polly();
const synthesizeSpeech = Promise.promisify(polly.synthesizeSpeech, { context: polly });
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
    const upload = Promise.promisify(bucket.upload, { context: bucket });
    return upload(filePath);
}

function recognizeSpeech() {
    const request = {
        config: {
            languageCode: 'en-US',
        },
        audio: {
            uri: `gs://${bucketName}/avs_response.flac`,
        },
    };
    return speechClient.recognize(request);
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
        .then((data) => {
            fs.writeFileSync(filePath('polly.mp3'), data.AudioStream);
            // Convert audio to avs accepted format
            return exec([
                'sox',
                filePath('polly.mp3'),
                '-c 1 -r 16000 -e signed -b 16',
                filePath('avs_request.wav'),
            ].join(' '));
        })
        .then(() => (
            exec([
                'curl -i -k',
                `-H "Authorization: Bearer ${token}"`,
                '-F "metadata=<metadata.json;type=application/json; charset=UTF-8"',
                `-F "audio=<${filePath('avs_request.wav')};type=audio/L16; rate=16000; channels=1"`,
                `-o ${filePath('avs_response.txt')}`,
                'https://access-alexa-na.amazon.com/v1/avs/speechrecognizer/recognize',
            ].join(' '))
        ))
        .then(() => {
            const response = fs.readFileSync(filePath('avs_response.txt'));
            const parsedMessage = httpMessageParser(response);
            const multipart = parsedMessage.multipart[1];
            fs.writeFileSync(filePath('avs_response.mp3'), multipart.body);
            return exec([
                'sox',
                filePath('avs_response.mp3'),
                filePath('avs_response.flac'),
            ].join(' '));
        })
        .then(() => uploadSpeech(filePath('avs_response.flac')))
        .then(() => recognizeSpeech())
        .then((response) => {
            console.log(response[0].results[0].alternatives[0].transcript);
        }, console.error);
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
