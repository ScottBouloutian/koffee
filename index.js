#!/usr/bin/env node

const auth = require('./auth');
const { order, balance } = require('./order');
const ora = require('ora');

const args = process.argv.slice(2);
const spinner = ora('Loading coffee...');

switch (args[0]) {
case 'auth':
    auth.login();
    break;
case 'order':
    spinner.start();
    auth.refresh()
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
    spinner.start();
    auth.refresh()
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
    console.log('Try typing auth or order');
}
