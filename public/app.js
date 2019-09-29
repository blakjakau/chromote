var app = (function() {	
	var hasFocus = false;
	var input = document.querySelector('#main');

	syn.on('ready', function() {
		input.classList.add('ready');
	})

	window.addEventListener('pointerdown', function(e) {
		if(hasFocus) return;
		input.requestPointerLock();
		syn.send({
			type:'clearInputState'			
		});
	})	

	document.addEventListener('pointerlockchange', (e)=>{
		if(document.pointerLockElement === input) {
			hasFocus = true;
			input.classList.add('active');
			window.moveTo((screen.availWidth*.33)/2,(screen.availHeight*0.33)/2); 
			window.resizeTo(screen.availWidth*.66,screen.availHeight*.66); 
		} else {
			hasFocus = false;
			syn.send({
				type:'clearInputState',
			})
			input.classList.remove('active');
			setTimeout(function() {
				window.close();
				chrome.runtime.getBackgroundPage(function(bgp) {bgp.reloadWindow();})
			},100);
		}
		console.log(e);
	});


	var mouse = 'mouseup mousedown mousemove mousewheel'.split(' ');
	var key = 'keydown keyup'.split(' ');
	
	input.addEventListener('contextmenu', function(event) {
		console.log(event.type);
		event.preventDefault();
		return false;
	})


	mouse.forEach((e)=>{
		input.addEventListener(e, event=>{
			if(!hasFocus) return;
			//console.log(event.type);
			syn.send({
				type:'input',
				data:{
					type:event.type.replace('pointer', 'mouse'),
					x: event.movementX,
					y:event.movementY,
					z: event.wheelDelta,
					button:event.button+1
				}
			})
		});
	});

	var escapeCount = 0;
	var escapeTimer = null;
	var escapeCheck = function() {
		if(escapeCount>=3) {
			document.exitPointerLock();
		}
		escapeCount = 0;
	}

	key.forEach((e)=>{
		window.addEventListener(e, event=>{
			if(!hasFocus) return;
			// if(event.keyCode == 27) { hasFocus = false; }
			console.log(event.type, event.keyCode, event.key);
			event.preventDefault();
			//event.cancelBubble();	

			var mod = '';
			// var mod = ''+(event.shiftKey&&event.key!='Shift'?"shift+":'')+
			// 			(event.ctrlKey&&event.key!='Control'?"ctrl+":'')+
			// 			(event.altKey&&event.key!='Alt'?"alt+":'')+
			// 			'';
						// (event.metaKey&&event.key!='Meta'?"meta+":'');

			var key = event.key;

			if(event.key == 'Escape' && event.ctrlKey) {
				document.exitPointerLock();
			}

			if(event.key == 'Escape' && event.type == 'keyup') {
				escapeCount++;
				clearTimeout(escapeTimer);
				escapeTimer = setTimeout(escapeCheck, 300);
				console.log('escape attempt', escapeCount)
			}

			if(key=='shift') {
				input.shiftState = (event.type == 'keydown');
			}

			// map some keys to their linux symbols

			switch(key.toLowerCase()) {
				case 'meta': key='\u0000'; break;
				case 'arrowup': key='Up'; break;
				case 'arrowdown': key='Down'; break;
				case 'arrowleft': key='Left'; break;
				case 'arrowright': key='Right'; break;
				case "enter": key='Return'; break;
				case "pageup": key='Prior'; break;
				case 'pagedown': key='Next'; break;
				case ".": key='period'; break;
				case ' ': key='space'; break;
				case '\'': key='apostrophe'; break;
				case '"': key='quotedbl'; break;
				case '/': key='slash'; break;
				case '\\': key='backslash'; break;
				case '|': key='bar'; break;
				case ',': key='comma'; break;

				case '<': key='less'; break;
				case '>': key='greater'; break;
				case '?': key='question'; break;
				case '!': key='exclam'; break;
				case '@': key='at'; break;
				case '#': key='numbersign'; break;
				case '$': key='dollar'; break;
				case '%': key='percent'; break;
				case '^': key='asciicircum'; break;
				case '&': key='ampersand'; break;
				case '*': key='asterisk'; break;
				case '(': key='parenleft'; break;
				case ')': key='parenright'; break;
				case '_': key='underscore'; break;
				case '+': key='plus'; break;
				case '-': key='minus'; break;
				case '=': key='equal'; break;
				case '`': key='grave'; break;
				case '~': key='asciitilde'; break;
				case '[': key='bracketleft'; break;
				case ']': key='bracketright'; break;
				case '{': key='braceleft'; break;
				case '}': key='braceright'; break;
				case ';': key='semicolon'; break;
				case ':': key='colon'; break;
				case '': key=''; break;
				case '': key=''; break;
				case '': key=''; break;
				case '': key=''; break;
				case '': key=''; break;
				case '': key=''; break;
				case 'backspace': key='BackSpace'; break;
			}

			syn.send({
				type:'input',
				data:{
					type:event.type,
					keyCode: event.keyCode,
					key: mod+key
				}
			})
		}, true);
	});
	return {};
})();