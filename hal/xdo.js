//xdo interface for LINUX
module.exports = (function() {
	const spawn = require('child_process').spawn;
	const execSync = require('child_process').execSync;
	const exec = require('child_process').exec;
	const fs = require('fs');

	var keysDown = {};

	// this was the initial proof of concept driver
	// it's hacky, and inefficient, but it took very little
	// setup and it was easy to debug from commandline

	// extending this, due to it being easy to support on Ubuntu 14.04
	// which is what my old workstation runs

	// check for xsel
	var environCaps = {
		clipboard: (function(){
			try {
				xsel = execSync('which xsel');
				if(xsel) {
					console.log('Clipboard supported via', xsel.toString())
					return xsel;
				}
			} catch(e) {
				console.log('No Clipboard support. To use shared clipboard, install xsel or xclip (e.g. on ubuntu: apt-get install xsel)')
				return false;
			}
		 })()
	}

	var keyMap = {
		// mapping chrome/web keys to xdotool's key constants.... for fun and profit
		// also, this way the client doesn't need to be aware of what the receiving platform's HAL is doing
		'arrowup':'Up',
		'arrowdown':'Down',
		'arrowleft':'Left',
		'arrowright':'Right',
		"enter":'Return',
		"pageup":'Prior',
		'pagedown':'Next',
		".":'period',
		' ':'space',
		'\'':'apostrophe',
		'"':'quotedbl',
		'/':'slash',
		'\\':'backslash',
		'|':'bar',
		',':'comma',
		'<':'0x0ba3',
		'>':'0x0ba6',
		'?':'question',
		'!':'exclam',
		'@':'at',
		'#':'numbersign',
		'$':'dollar',
		'%':'percent',
		'^':'asciicircum',
		'&':'ampersand',
		'*':'asterisk',
		'(':'parenleft',
		')':'parenright',
		'_':'underscore',
		'+':'plus',
		'-':'minus',
		'=':'equal',
		'`':'grave',
		'~':'asciitilde',
		'[':'bracketleft',
		']':'bracketright',
		'{':'braceleft',
		'}':'braceright',
		';':'semicolon',
		':':'colon',
		'backspace':'BackSpace',
	};

	var mouseTrack;

	var hal = {
		// sometimes a key might get stuck.
		// connect/disconnect triggers a clearInput event
		handler: null,
		clearInput: function() {
			console.log('Clear Input State');
			for(var k in keysDown) {
				spawn('xdotool',['keyup', k]);
				keysDown[k] = false;
			}
		},

		process: function(input) {
			if(input.key && input.key.toLowerCase && keyMap[input.key.toLowerCase()]) input.key = keyMap[input.key.toLowerCase()];

			switch(input.type) {
				case "mousewheel":
					if(input.z > 0) {
						spawn('xdotool',['mousedown', 4, 'mouseup', 4]);
					} else {
						spawn('xdotool',['mousedown', 5, 'mouseup', 5] );
					}
				break;
				case "mousemove":
					spawn('xdotool',['mousemove_relative', '--', input.x,input.y]);
					mouseTrack(input.x, input.y);

				break;
				case "mousedown":
					spawn('xdotool',['mousedown', input.button]);
					keysDown['mouse'+input.button] = true;
				break;
				case "mouseup":
					spawn('xdotool',['mouseup', input.button]);
					keysDown['mouse'+input.button] = false;
				break;
				case "keydown":
					//console.log(input.key);
					spawn('xdotool',['keydown', input.key]);
					keysDown[input.key] = true;
				break;
				case "keyup":
					spawn('xdotool',['keyup', input.key]);
					keysDown[input.key] = false;
				break;
				case "copy":
					//spawn('xdotool',['keydown', 'C']);

					console.log('COPY');
					execSync('xdotool keydown C');
					keysDown['C'] = true;

					//spawn('xdotool',['keyup', 'C']);
					execSync('xdotool keyup C');
					keysDown['C'] = false;

					if(environCaps.clipboard) {
						// can we branch this to use either xsel or xclip?
						var result = execSync('xsel --output --clipboard');
						// now we have the clipboard text, let's send it back to the chromote source
						if(hal.handler) {
							hal.handler.eventBroadcast({
								type:'copy',
								clipboard:result.toString()
							});
							//console.log(result);
						}
					}

				break;
				case 'paste':
					// process a paste event using the chromote source clipboard
					// via xsel (if available), otherwise a client-side paste (CTRL+V) will happen

					if(environCaps.clipboard) {
						if(input.clipboard) {
							fs.writeFileSync('/tmp/chromote-clipboard.tmp', input.clipboard);
							execSync('cat /tmp/chromote-clipboard.tmp | xsel --input --clipboard');
						}
						console.log('PASTE');
					}

					setTimeout(function() {
						execSync('xdotool keydown V');
						keysDown['V'] = true;

						execSync('xdotool keyup V');
						keysDown['V'] = false;
						execSync('xdotool keyup Shift');
					}, 50)

				break;
			}
		}
	}

	mouseTrack = (function() {

		// see if we can use xdotool to get the absolute mouse position
		var xdoSupport = (function() {
			try {
				var xdo = execSync('which xdotool');
				if(xdo) {
					console.log('Screen-edge supported via', xdo.toString())
					return true;
				}
			} catch(e) {
				console.log('No screen-edge support. To use screen edge triggers, install xdotool (e.g. on ubuntu: apt-get install xdotool)');
				return false;
			}
		})();

		// get the resolution of the desktop, this will all go pear shapped
		// if the desktop isn't a rectangle (e.g. multiple monitors but NOT in a line/stack)
		var maxX = 0, maxY = 0;
		var dimensions = execSync("xdpyinfo | grep 'dimensions';");
		;(function() {
			var bits = dimensions.toString().split(/\s/);
			bits = bits.filter(b => b.length>0);
			var dim = bits[1].split('x');
			maxX = dim[0]-1;
			maxY = dim[1]-1;
			console.log('Screen resolution', maxX+1, maxY+1);
		})();

		// adding tracking for the current mouse coord in real time, so that we can use an "active-edge" approach
		var locX=0, locY=0;
		var edgeTolerance = 32; // how hard do we push against an edge before it trigger?

		var movX=0,movY=0;
		var checking = false
		var worker = function(x, y) {
			if(!xdoSupport) return;
			if(checking) {
				//don't do an edge check if we're still waiting for the last, but update the x/y values
				// so we're getting the full story!
				movX+=parseInt(x);
				movY+=parseInt(y);
				return;
			} else {
				movX=parseInt(x);
				movY=parseInt(y);
			}
			var child = spawn('xdotool', ['getmouselocation']);
			var res='';
			checking = true;
			child.stdout.on('data', data=>{ res+=data.toString(); });
			child.on('close', code=>{
				checking=false;
				if(code==0) {
					var bits = res.split(' ');
					locX = bits[0].split(':')[1];
					locY = bits[1].split(':')[1];
					
					var edge=undefined;
					if( parseInt(locY)+parseInt(movY) > maxY+edgeTolerance ) { edge = 'bottom'; }
					if( parseInt(locY)+parseInt(movY) < -edgeTolerance ) { edge = 'top'; }
					if( parseInt(locX)+parseInt(movX) > maxX+edgeTolerance ) { edge = 'right'; }
					if( parseInt(locX)+parseInt(movX) < 0-edgeTolerance ) { edge = 'left'; }

					worker.x = locX;
					worker.y = locY;
					worker.edge = edge;
					
					if(edge !== undefined) {
						// console.log('edge trigger',locX/maxX, locY/maxY, edge);
						// send a EDGE message the handler
						// but NOT if a key or mouse button is currently DOWN;
						
						for(var k in keysDown) {
							if(keysDown[k]) {
								console.log("no Edge, because keydown", k);
								return;
							}
						}
						if(hal.handler) {
							hal.handler.eventBroadcast({
								type:'edge',
								edge:edge,
								x: locX/maxX,
								y: locY/maxY,
							});
						}
					}
				}
			});
		}
		worker.x = undefined;
		worker.y = undefined;
		worker.edge = undefined;
		return worker;
	})();
	return hal;
})();