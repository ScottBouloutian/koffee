#!/usr/bin/env node

const auth = require('./auth');
const { order, balance } = require('./order');
const ora = require('ora');
const figletLib = require('figlet');
const Promise = require('bluebird');

const args = process.argv.slice(2);
const spinner = ora('☕️ Loading coffee...');
const figlet = Promise.promisify(figletLib);

function showAscii() {
    return figlet('Koffee').then(data => console.log(data));
}

switch (args[0]) {
case 'auth':
    auth.login();
    break;
case 'order':
    showAscii()
        .then(() => {
            spinner.start();
            return auth.refresh();
        })
        .then(() => order())
        .then((result) => {
            spinner.stop();
            console.log(result);
        })
        .catch((error) => {
            spinner.stop();
            console.error(error);
        });
    break;
case 'balance':
    showAscii()
        .then(() => {
            spinner.start();
            return auth.refresh();
        })
        .then(() => balance())
        .then((result) => {
            spinner.stop();
            console.log(result);
        })
        .catch((error) => {
            spinner.stop();
            console.error(error);
        });
    break;
default:
    console.log('Try typing auth, order, or balance');
}
