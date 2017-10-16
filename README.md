# koffee

[![Greenkeeper badge](https://badges.greenkeeper.io/ScottBouloutian/koffee.svg)](https://greenkeeper.io/)

```
koffee get # re-orders your last coffee order
kofee balance # checks your available balance
```
This project is a convoluted way to order your Starbucks coffee directly from your terminal.

## Getting Started
- Download and configure the Starbucks skill for Alexa
- Configure AWS credentials for your machine
- Create a Google app with access to their cloud and speech APIs
- Install sox `brew install sox --with-flac`

### Environment Variables

- `KOFFEE_GOOGLE_BUCKET` - google cloud storage bucket where an audio file will be uploaded
- `KOFFEE_GOOGLE_JSON` - path to the JSON credentials of your google application
- `KOFFEE_CLIENT_ID` - client id of your Alexa voice service application
- `KOFFEE_CLIENT_SECRET` - client secret of your Alexa voice service application
- `KOFFEE_PRODUCT_ID` - product id of your Alexa voice service application
- `KOFFEE_DEVICE_ID` - unique device id for the device running this application
