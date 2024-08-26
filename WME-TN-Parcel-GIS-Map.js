// ==UserScript==
// @name         WME TN Parcel GIS Map
// @namespace    https://greasyfork.org/users/45389
// @version      2024.08.22.001
// @description  Open the TN Parcel GIS map in another window, at the same location as the WME map.  Keeps the location of the GIS map synced to WME.
// @author       MapOMatic
// @match        *://*.waze.com/*editor*
// @exclude      *://*.waze.com/user/editor*
// @match        https://tnmap.tn.gov/assessment/beta/*
// @license      GNU GPLv3
// ==/UserScript==

/* global W */
/* global getWmeSdk */

const URL_PROTOCOL = 'https://';
const URL_DOMAIN = 'tnmap.tn.gov';
const URL_PATH = '/assessment/beta/';
const WINDOW_NAME = 'tn_gis_map';
const BUTTON_ID = 'tn-gis-button';
const BUTTON_TITLE = 'Open the TN GIS map in a new window';
const LOG_SCRIPT_NAME = 'TN Parcel GIS';

let _mapWindow;
let sdk;

(function main() {
    'use strict';

    function log(message) {
        console.log(LOG_SCRIPT_NAME, message);
    }
    function logDebug(message) {
        console.debug(LOG_SCRIPT_NAME, message);
    }

    function onButtonClick() {
        const url = URL_PROTOCOL + URL_DOMAIN + URL_PATH;
        if (!_mapWindow || _mapWindow.closed) {
            _mapWindow = window.open(null, WINDOW_NAME);
            try {
                if (_mapWindow.location && _mapWindow.location.href) {
                    _mapWindow.location.assign(url);
                    setTimeout(() => syncGISMapExtent(_mapWindow), 2000);
                }
            } catch (ex) {
                if (ex.code === 18) {
                // Ignore if accessing location.href is blocked by cross-domain.
                } else {
                    throw ex;
                }
            }
        }
        _mapWindow.focus();
        setTimeout(() => syncGISMapExtent(_mapWindow), 2000);
    }

    function syncGISMapExtent(myMapWindow) {
        if (myMapWindow && !myMapWindow.closed) {
            const centerPoint = sdk.Map.getMapCenter();
            const zoom = sdk.Map.getZoomLevel();
            try {
                myMapWindow.postMessage({
                    lon: centerPoint.coordinates[0],
                    lat: centerPoint.coordinates[1],
                    zoom
                }, URL_PROTOCOL + URL_DOMAIN);
            } catch (ex) {
                log(ex);
            }
        }
    }

    function init() {
        logDebug('Initializing...');
        sdk = getWmeSdk({ scriptId: 'wmeTNGISParcelMap', scriptName: 'WME TN GIS Parcel Map' });

        $('.WazeControlPermalink').prepend(
            $('<div>').css({ float: 'left', display: 'inline-block', padding: '0px 5px 0px 3px' }).append(
                $('<a>', { id: BUTTON_ID, title: BUTTON_TITLE })
                    .text('TN-GIS')
                    .css({
                        float: 'left',
                        textDecoration: 'none',
                        color: '#000000',
                        fontWeight: 'bold'
                    })
                    .click(onButtonClick)
            )
        );

        setInterval(() => {
            const $btn = $(`#${BUTTON_ID}`);
            if ($btn.length > 0) {
                $btn.css('color', (_mapWindow && !_mapWindow.closed) ? '#1e9d12' : '#000000');
            }
        }, 1000);

        /* Event listeners */
        // SDK: FR submitted
        W.map.events.register('moveend', null, () => syncGISMapExtent(_mapWindow));

        logDebug('Initialized.');
    }

    let waitingForDetailsToClose = false;
    let lastData = null;

    function receiveMessageGIS(event) {
        logDebug(event);
        const { data } = event;
        lastData = data;
        if (!window.location.href.includes('parcel')) {
            window.location.assign(`https://tnmap.tn.gov/assessment/beta/#/location/${data.lat}/${data.lon}/${data.zoom}`);
        } else if (!waitingForDetailsToClose) {
            waitingForDetailsToClose = true;
            updateLocationWhenDetailsClosed();
        }
    }

    function updateLocationWhenDetailsClosed() {
        if (window.location.href.includes('parcel')) {
            setTimeout(updateLocationWhenDetailsClosed, 100);
        } else {
            window.location.assign(`https://tnmap.tn.gov/assessment/beta/#/location/${lastData.lat}/${lastData.lon}/${lastData.zoom}`);
            waitingForDetailsToClose = false;
        }
    }

    function bootstrap() {
        if (window.location.host.toLowerCase() === URL_DOMAIN) {
            window.addEventListener('message', receiveMessageGIS, false);
        } else if (window.getWmeSdk) {
            init();
        } else {
            document.addEventListener('wme-ready', init, { once: true });
        }
    }

    logDebug('Bootstrap...');
    bootstrap();
})();
