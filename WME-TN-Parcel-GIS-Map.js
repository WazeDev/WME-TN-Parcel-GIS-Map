// ==UserScript==
// @name         WME TN Parcel GIS Map
// @namespace    https://greasyfork.org/users/45389
// @version      2024.08.21.001
// @description  Open the TN Parcel GIS map in another window, at the same location as the WME map.  Keeps the location of the GIS map synced to WME.
// @author       MapOMatic
// @match        *://*.waze.com/*editor*
// @exclude      *://*.waze.com/user/editor*
// @match        https://tnmap.tn.gov/assessment/
// @license      GNU GPLv3
// ==/UserScript==

/* global W */
/* global map */
/* global OpenLayers */

const URL_PROTOCOL = 'https://';
const URL_DOMAIN = 'tnmap.tn.gov';
const URL_PATH = '/assessment/';
const WINDOW_NAME = 'tn_gis_map';
const BUTTON_ID = 'tn-gis-button';
const BUTTON_TITLE = 'Open the TN GIS map in a new window';
const LOG_SCRIPT_NAME = 'TN Parcel GIS';

let Extent;
let SpatialReference;
let _mapWindow;

(function main() {
    'use strict';

    function log(message) {
        console.log(LOG_SCRIPT_NAME, message);
    }
    function logDebug(message) {
        console.debug(LOG_SCRIPT_NAME, message);
    }

    function getOLMapExtent() {
        let extent = W.map.getExtent();
        if (Array.isArray(extent)) {
            extent = new OpenLayers.Bounds(extent);
            extent.transform('EPSG:4326', 'EPSG:3857');
        }
        return extent;
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
        syncGISMapExtent(_mapWindow);
    }

    function syncGISMapExtent(myMapWindow) {
        if (myMapWindow && !myMapWindow.closed) {
            const wazeExt = getOLMapExtent();
            try {
                myMapWindow.postMessage({
                    type: 'setExtent',
                    xmin: wazeExt.left,
                    xmax: wazeExt.right,
                    ymin: wazeExt.bottom,
                    ymax: wazeExt.top,
                    spatialReference: 102113
                }, URL_PROTOCOL + URL_DOMAIN);
            } catch (ex) {
                log(ex);
            }
        }
    }

    function init() {
        logDebug('Initializing...');
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
        W.map.events.register('moveend', null, () => syncGISMapExtent(_mapWindow));

        logDebug('Initialized.');
    }

    function receiveMessageGIS(event) {
        logDebug(event);
        const { data } = event;
        if (!Extent) {
            Extent = unsafeWindow.require('esri/geometry/Extent');
            SpatialReference = unsafeWindow.require('esri/SpatialReference');
        }

        const ext = new Extent({
            xmin: data.xmin,
            xmax: data.xmax,
            ymin: data.ymin,
            ymax: data.ymax,
            spatialReference: new SpatialReference({ wkid: data.spatialReference })
        });
        map.setExtent(ext);
    }

    function bootstrap() {
        if (window.location.host.toLowerCase() === URL_DOMAIN) {
            window.addEventListener('message', receiveMessageGIS, false);
        } else if (W && W.loginManager && W.loginManager.events.register && W.map) {
            init();
        } else {
            logDebug('Bootstrap failed. Trying again...');
            window.setTimeout(bootstrap, 500);
        }
    }

    logDebug('Bootstrap...');
    bootstrap();
})();
