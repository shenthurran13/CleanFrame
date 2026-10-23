/* Public Tizen application APIs. No Mac server, network address or credentials. */
(function () {
  'use strict';
  var IDS = {
    netflix: 'org.tizen.netflix-app',
    iplayer: 'DqEoaplKlw.bbchybrid',
    itvx: 'OEvCiupaFR.ITVHub',
    channel4: 'OCaxbgg9v6.chfourctv',
    disneyplus: 'MCmYXNxgcu.DisneyPlus',
    primevideo: 'org.tizen.primevideo',
    youtube: '9Ur5IzDKqV.TizenYouTube',
    stremio: 'IkWsFHtOY9.Stremio',
    livetv: 'input.tv',
    firetv: 'input.hdmi'
  };
  var STREAMING = ['1Qb6IoAcGC.NowTV', 'com.samsung.tv.aria-video', 'EkzyZtmneG.My5', 'VQr0RGkyS9.UKTVPlay', 'rJeHak5zRg.Spotify',
    '3KA0pm7a7V.TubiTV', 'org.tizen.apple.apple-music'];
  /* App IDs can change between firmware/regions. If an ID misses, match the installed app by name. */
  var NAMES = { netflix: /^netflix$/i, iplayer: /iplayer/i, itvx: /^itv/i, channel4: /channel ?4|all ?4/i,
    disneyplus: /disney/i, primevideo: /prime video/i, youtube: /^youtube$/i, stremio: /^stremio$/i };
  var CONSUMER_SYSTEM = ['org.tizen.browser', 'com.microsoft.copilot'];
  var EXTRA_BRANDS = {'rJeHak5zRg.Spotify': 'spotify', '5b8c3eb16b.BeamCTVDev': 'hbomax', '3KA0pm7a7V.TubiTV': 'tubi',
    'com.samsung.tv.aria-video': 'appletv', '1Qb6IoAcGC.NowTV': 'now', 'org.tizen.apple.apple-music': 'applemusic'};
  var INTERNAL = ['adplatform.ADPlayer', 'WykOS4t4F0.cmsWebApp', '25emanual3.emanual',
    'ZODRT12q2l.WebAccountExtension', 'ByJlgt0XeD.CastSettingsApp', 'tv6pbVMQFF.PrivacyChoices'];
  var SELF = 'nClrkHome1.FrameHome';
  function api() { return window.tizen && window.tizen.application; }
  function unavailable(done) {
    done({ message: 'Open CleanFrame on the TV to use this control.', detail: 'The web preview cannot control the TV.' });
  }
  function failure(err) {
    return { message: 'The TV could not open this screen.', detail: err && (err.message || err.name) || 'Try again, or press the remote’s Home button to return to CleanFrame.' };
  }
  function bounded(done) {
    var finished = false, timer = setTimeout(function () { finish({ message: 'The TV did not respond. Please try again.' }); }, 8000);
    function finish(err, value) { if (finished) return; finished = true; clearTimeout(timer); done(err, value); }
    return finish;
  }
  function launchApp(id, done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    try { api().launch(id, function () { finish(null); }, function (err) { finish(failure(err)); }); }
    catch (err) { finish(failure(err)); }
  }
  function byName(brand, done) {
    if (!api() || !NAMES[brand]) { done(null); return; }
    try {
      api().getAppsInfo(function (list) {
        for (var i = 0; i < list.length; i++) if (list[i].name && NAMES[brand].test(list[i].name)) { done(list[i].id); return; }
        done(null);
      }, function () { done(null); });
    } catch (err) { done(null); }
  }
  function launch(brand, done) {
    if (brand === 'firetv') { input('HDMI', done); return; }
    if (brand === 'livetv') { input('TV', done); return; }
    if (!IDS[brand]) { done({message: 'This app has no launch target.'}); return; }
    launchApp(IDS[brand], function (err) {
      if (!err || !api()) { done(err); return; }
      byName(brand, function (id) {
        if (!id || id === IDS[brand]) { done(err); return; }
        IDS[brand] = id; launchApp(id, done);
      });
    });
  }
  function art(done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    try {
      var data = [new tizen.ApplicationControlData('mode', ['fullscreen']), new tizen.ApplicationControlData('requester', ['mobile'])];
      var control = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, data);
      api().launchAppControl(control, 'org.tizen.art-app', function () { finish(null); }, function (err) { finish(failure(err)); });
    } catch (err) { finish(failure(err)); }
  }
  /* Live inputs via the public TVWindow API: 'HDMI' = first connected HDMI input, 'TV' = the built-in tuner. */
  var CHANNEL_KEYS = ['ChannelUp', 'ChannelDown'], channelKeys = false;
  function channelName(tv) {
    try { var c = tv.tvchannel && tv.tvchannel.getCurrentChannel('MAIN'); return c ? ((c.major ? c.major + '  ' : '') + (c.channelName || '')).trim() : ''; }
    catch (err) { return ''; }
  }
  function keys(on) {
    var d = window.tizen && window.tizen.tvinputdevice;
    if (!d || channelKeys === on) return;
    CHANNEL_KEYS.forEach(function (k) { try { if (on) d.registerKey(k); else d.unregisterKey(k); } catch (err) { /* key may not exist on this remote */ } });
    channelKeys = on;
  }
  function input(kind, done) {
    var tv = window.tizen, tuner = kind === 'TV';
    if (!tv || !tv.tvwindow || !tv.systeminfo) { unavailable(done); return; }
    var finish = bounded(done);
    try {
      tv.systeminfo.getPropertyValue('VIDEOSOURCE', function (info) {
        var pick = null;
        (info && info.connected || []).forEach(function (s) { if (!pick && s.type === kind) pick = s; });
        if (!pick) {
          finish(tuner ? { message: 'Live TV is not available.', detail: 'Check the aerial is connected and channels have been tuned in Samsung settings.' }
            : { message: 'No connected HDMI input was found.', detail: 'Check the Fire TV Stick is plugged in and powered.' });
          return;
        }
        tv.tvwindow.setSource(pick, function () {
          tv.tvwindow.show(function () {
            if (tuner) keys(true);
            finish(null, { type: pick.type, number: pick.number, channel: tuner ? channelName(tv) : '' });
          }, function (err) { finish(failure(err)); }, ['0px', '0px', '1920px', '1080px'], 'MAIN');
        }, function (err) { finish(failure(err)); }, 'MAIN');
      }, function (err) { finish(failure(err)); });
    } catch (err) { finish(failure(err)); }
  }
  function channel(step, done) {
    var tv = window.tizen, c = tv && tv.tvchannel, finished = false;
    function finish(err, name) { if (!finished) { finished = true; done(err, name); } }
    if (!c) { finish({ message: 'Channel changing is not available here.' }); return; }
    try {
      c[step > 0 ? 'tuneUp' : 'tuneDown']({
        onsuccess: function () { finish(null, channelName(tv)); },
        onnosignal: function () { finish(null, (channelName(tv) + '  No signal').trim()); },
        onprograminforeceived: function () {}
      }, function (err) { finish({ message: 'Could not change channel', detail: err && err.message }); }, 'ALL', 'MAIN');
    } catch (err) { finish({ message: 'Could not change channel', detail: err && err.message }); }
  }
  function stopInput(done) {
    keys(false);
    try { window.tizen.tvwindow.hide(function () { done(); }, function () { done(); }, 'MAIN'); } catch (err) { done(); }
  }
  function home(done) { launchApp('com.samsung.tv.csfs', done); }
  function settings(done) { launchApp('com.samsung.tv.coba.setting', done); }
  function apps(done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    try {
      api().getAppsInfo(function (list) {
        var known = {}, seen = {}, result = [];
        Object.keys(IDS).forEach(function (brand) { known[IDS[brand]] = brand; });
        list.forEach(function (a) {
          if (known[a.id] || !a.name) return;
          Object.keys(NAMES).forEach(function (brand) {
            var taken = list.some(function (b) { return b.id === IDS[brand]; });
            if (!taken && NAMES[brand].test(a.name)) { IDS[brand] = a.id; known[a.id] = brand; }
          });
        });
        list.forEach(function (a) {
          var primary = !!known[a.id], stream = STREAMING.indexOf(a.id) >= 0;
          var consumer = /^[A-Za-z0-9]{10}\.[A-Za-z0-9_-]+$/.test(a.id) || CONSUMER_SYSTEM.indexOf(a.id) >= 0;
          if (a.id === SELF || INTERNAL.indexOf(a.id) >= 0 || seen[a.id] || !a.name || (!primary && !stream && (!a.show || !consumer))) return;
          if (!primary && /(?:service|worker|preview|promotion|plugin|launcher|test|sdk|^ep[ -]|factory|daemon)/i.test(a.name + ' ' + a.id)) return;
          if (/-dummy$/.test(a.id) || a.id === 'com.samsung.tv.cobalt-yt') return;
          seen[a.id] = true;
          result.push({ appId: a.id, name: a.name, brand: known[a.id] || EXTRA_BRANDS[a.id] || '', icon: a.iconPath || '', rank: primary ? Object.keys(IDS).indexOf(known[a.id]) : (stream ? 20 : 30) });
        });
        result.sort(function (a, b) { return a.rank - b.rank || a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });
        finish(null, result);
      }, function (err) { finish(failure(err)); });
    } catch (err) { finish(failure(err)); }
  }
  function hasInputs() { return !!(window.tizen && window.tizen.tvwindow && window.tizen.systeminfo); }
  window.FrameDevice = { hasInputs: hasInputs, input: input, channel: channel, stopInput: stopInput, launch: launch, launchApp: launchApp, art: art, home: home, settings: settings, apps: apps };
}());
