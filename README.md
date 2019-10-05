# chromote
Chrome Extension + NodeJS app for sharing Chromebook keyboard+mouse with a Linux desktop

This is my prototype code for sharing my chromebook keyboard with my linux workstations.

In used this daily for over a year at work and at home on an Asus Flip ca302, but since discontinued 
due to changing workflow on my pixelbook.

I'm posting this here at the request of a user from the synergy forum, I am not actively developing this software

Prereqs:
- Ubuntu 14.04+ 
- working nodeJS+npm install
- ChromeOS device

Getting started (linux / receiver):
- clone the repo
- cd into the repo folder
- npm install
- npm start
- if you want shared clipboard support you need to install xsel [sudo apt install xsel] on your linux system

Getting started (ChromeOS device):
- set the IP address of your linux system in ./sender/app.js
- create an unpackaged extension from ./sender
- the extension will run as a 2px bar at the to of your chromeOS screen, click it to connect to your linux system

The output of the nodeJS and sender apps are pretty verbose at the moment.

How it works:
The chrome extension creates a trigger bar at the top of the screen. When clicked, this bar expands to a full-screen window, capturing the mouse and listening for keyboard events. The extension connects via websocket to the node app running on the linux system. 

The full screen window was required because the Chrome mouseCapture API would cap the mouse movement reporting to the distance from the center of the active window to the eadge of the screen - not sure if this bug still exists.

Keyboard events (key downs and ups) and (relative) mouse events are sent to the receiver, which are triggered in the linux OS using either xdo or uinput. 

Relative mouse is used on the receiver, because it worked seemlessly with the games I was occassionally running in Steam on my linux machine, whereas absolute positioning causes unpredicatable (usually bad) results.
