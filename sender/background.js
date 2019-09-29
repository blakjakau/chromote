// Create a new app window.

chrome.app.runtime.onLaunched.addListener(function(launchData) {

  var bg = window;
  var lastWindow;
  bg.reloadWindow = function() {
    //if(lastWindow) {
    try {
      lastWindow.close();
    } catch(e) {
      console.log('Failed to close old window', e);
    }
    //}
    return chrome.app.window.create(
      'index.html',
      {
        // id: 'chromote',
        frame:'none',
        // Bounds will have effect only on the first start after app installation
        // in a given Chromium instance. After that, size & position will be
        // restored from the window id above.
        
        // outerBounds: {
        //   left:(screen.availWidth)-32,
        //   top:(screen.availHeight/2)-32,
        //   width: 32,
        //   height: 64
        // },
        outerBounds: {
          left:0,//screen.availWidth/8,
          top:0,
          width: screen.availWidth,//(screen.availWidth/8)*6,
          height: 2,
        },
        // transparentBackground:true,
        minWidth: 32,
        minHeight: 48,
        resizable: false,
        alwaysOnTop:true,
      }, function() {

      }
    );
  }
  lastWindow = bg.reloadWindow();
});
