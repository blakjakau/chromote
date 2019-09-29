# chromote
Chrome Extension + NodeJS app for sharing Chromebook keyboard+mouse with a Linux desktop

This is my prototype code for sharing my chromebook keyboard with my linux workstations.

In used this daily for over a year at work and at home on an Asus Flip ca302, but since discontinued 
due to change workflow on my pixelbook.

I'm posting this here at the request of a user from the synergy forum, I am not actively developing this software

Prereqs:
- Ubuntu 14.04+ 
- working nodeJS+npm install
- ChromeOS device

Getting started (linux/client):
- clone the repo
- cd into the repo folder
- npm install
- npm start

Getting started (ChromeOS device):
- set the IP address of your linux system in ./sender/app.js
- create an unpackaged extension from ./sender
- the extension will run as a 2px bar at the to of your chromeOS screen, click it to connect to your linux system

The output of the nodeJS and sender apps are pretty verbose at the moment.
