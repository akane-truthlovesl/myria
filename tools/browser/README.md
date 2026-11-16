Real-browser checks (headless Chrome through puppeteer-core; files are served by request interception, no local server).
They need `npm i puppeteer-core` somewhere on the module path and Chrome at /usr/bin/google-chrome.
  node drive.mjs "/dev.html?room=3" out 1200 700 "w3500,mm:380:300,rclick:505:125,q,s"   # scripted input, status, screenshots
  node prof.mjs "/dev.html" 1905 2260 6      # V8 CPU profile with hot lines
  node soak.mjs 4500                          # autopilot through every Odyssey chamber, report errors
  node filetest.mjs                           # open the built index.html from file://
