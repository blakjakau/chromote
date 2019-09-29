var app = (function() {
	var hasFocus = false, requestingFocus = false, hasPointer = false;
	var input = document.querySelector('#main');
	var text = document.querySelector('#input');
	var stream = document.querySelector('#stream');
    // input.tabIndex = 0; // this way focus can come back on Search or ALT+TAB
	
	syn.on('ready', function() {
		input.classList.add('ready');
	})
	
	syn.on('disconnect', function() {
		input.classList.remove('ready');
	})

 window.addEventListener('load', function() {
    chrome.system.network.getNetworkInterfaces(function(ifs) {
      ifs.forEach((i)=>{
        // skip IPv6 and bridges... hopefully whatever is left is the
        // actual adapter and IPv4 address
        if(i.prefixLength < 64 && i.name.indexOf('br')==-1) {
          console.log(i);
          stream.innerHTML = 'chromote - '+i.address
        }
      })
      console.log(ifs);
    });
  })

	window.addEventListener('pointerdown', function(e) {
		if(hasFocus || requestingFocus) return;
		requestingFocus = true;
	
		document.documentElement.webkitRequestFullScreen();
		input.requestPointerLock();
		syn.send({
			type:'clearInputState'
		});
	})

	document.addEventListener('pointerlockchange', (e)=>{
		if(document.pointerLockElement === input) {
			hasFocus = true;
			requestingFocus = false;
			hasPointer = true;
			input.classList.add('active');
			input.classList.add('focus');
			text.focus();
			
		// 	window.moveTo(((screen.availWidth)/2)-256,((screen.availHeight)/2)-150);
		// 	window.resizeTo(512, 300);
		// 	window.moveTo((screen.availWidth/4),(screen.availHeight/2));
		// 	window.resizeTo((screen.availWidth/2), 32);
		} else {
			hasFocus = false;
			hasPointer = false;
			requestingFocus = false;
			input.classList.remove('focus');
			syn.send({
				type:'clearInputState',
			})
		}
		console.log(e);
	});


	var mouse = 'mouseup mousedown mousemove mousewheel'.split(' ');
	var key = 'keydown keyup'.split(' ');
	
	input.addEventListener('contextmenu', function(event) {
		console.log(event.type);
		event.preventDefault();
		return false;
	});

  // add some logic here to only fire the mouse wheel event when the cumulative delta is greater than....
  // var dropWheel = true;
  var wheelDelta = 0;
	mouse.forEach((e)=>{
		input.addEventListener(e, event=>{
			if(!hasFocus) return;
			//console.log(event.type);
		// 	if(event.type == 'mouseWheel' && dropWheel) return;
		console.log(event.wheelDelta);
		if(event.type == 'mousewheel') {
		  wheelDelta+=event.wheelDelta;
		  //if(Math.abs(wheelDelta) < 2) return;
		  wheelDelta = 0;
		// 	  dropWheel = true;
		// 	  setTimeout(()=>{dropWheel=false}, 250);
		}
			syn.send({
				type:'input',
				data:{
					type:event.type.replace('pointer', 'mouse'),
					x: event.movementX,
					y: event.movementY,
					z: event.wheelDelta,
					button:event.button+1
				}
			})
		});
	});

	var escapeCount = 0;
	var escapeTimer = null;
	var escapeNow = function() {
				document.exitPointerLock();
				window.close();
				chrome.runtime.getBackgroundPage(function(bgp) {bgp.reloadWindow();})
	}
	
	var escapeCheck = function() {
		if(escapeCount>=3) {
				escapeNow();
		}
		escapeCount = 0;
	}

  var clipboardPristine = true;

  text.addEventListener("paste", function(event) {
    if(!clipboardPristine) return;
    event.preventDefault();
    console.log('pasteEvent');
    console.log(event.clipboardData.getData('text/plain'));
    syn.send({
  		type:'input',
  		data:{
  			type:'paste',
  			keyCode: event.keyCode,
  			key: key,
  			clipboard: event.clipboardData.getData('text/plain')
  		}
  	})
  	clipboardPristine = false;
  })



	key.forEach((e)=>{
		window.addEventListener(e, event=>{
			if(!hasFocus) return;
			// if(event.keyCode == 27) { hasFocus = false; }
			//event.cancelBubble();
			var key = event.key;

			if(event.key == 'Escape' && event.ctrlKey) {
			  escapeNow();
				// window.close();
				// chrome.runtime.getBackgroundPage(function(bgp) {bgp.reloadWindow();})
				// document.exitPointerLock();
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
			// this allows xdotool to send the right keycodes without having a mapping on the other end.
			// ideally, all mapping should be done at the receiver. will need to tidy this Up
			
			switch(key.toLowerCase()) {
				case 'meta': key='\u0000'; break;
				case 'arrowup': key='Up'; break;
				case 'arrowdown': key='Down'; break;
				case 'arrowleft': key='Left'; break;
				case 'arrowright': key='Right'; break;
			}

      if(event.type=='keyup' && event.ctrlKey && (key=='c' || key=='x')) {
        syn.send({
      		type:'input',
      		data:{
      			type:'copy',
      			keyCode: event.keyCode,
      			key: key
      		}
      	})
      	clipboardPristine = false;
        return;
      } else if(event.ctrlKey && (key=='v')) {
        if(clipboardPristine) return;
      }
      
			console.log(event.type, event.keyCode, event.key);
			event.preventDefault();
			syn.send({
				type:'input',
				data:{
					type:event.type,
					keyCode: event.keyCode,
					key: key
				}
			})
		}, true);
	});
	return {};
})();