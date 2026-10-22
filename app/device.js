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
    appletv: 'com.samsung.tv.aria-video',
    now: '1Qb6IoAcGC.NowTV'
  };
  var STREAMING = ['EkzyZtmneG.My5', 'VQr0RGkyS9.UKTVPlay', 'rJeHak5zRg.Spotify',
    '3KA0pm7a7V.TubiTV', 'IkWsFHtOY9.Stremio', 'org.tizen.apple.apple-music'];
  /* App IDs can change between firmware/regions. If an ID misses, match the installed app by name. */
  var NAMES = { netflix: /^netflix$/i, iplayer: /iplayer/i, itvx: /^itv/i, channel4: /channel ?4|all ?4/i,
    disneyplus: /disney/i, primevideo: /prime video/i, youtube: /^youtube$/i, appletv: /^apple tv$/i, now: /^now( tv)?$/i };
  var CONSUMER_SYSTEM = ['org.tizen.browser', 'com.microsoft.copilot'];
  var EXTRA_BRANDS = {'rJeHak5zRg.Spotify': 'spotify', '5b8c3eb16b.BeamCTVDev': 'hbomax', '3KA0pm7a7V.TubiTV': 'tubi'};
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
  window.FrameDevice = { launch: launch, launchApp: launchApp, art: art, home: home, settings: settings, apps: apps };
}());
