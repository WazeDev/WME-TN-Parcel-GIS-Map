/* eslint-disable max-classes-per-file */
// ==UserScript==
// @name         WME TN Parcel GIS Map
// @namespace    https://greasyfork.org/users/45389
// @version      2024.08.22.001
// @description  Open the TN Parcel GIS map in another window, at the same location as the WME map.  Keeps the location of the GIS map synced to WME.
// @author       MapOMatic
// @match        *://*.waze.com/*editor*
// @exclude      *://*.waze.com/user/editor*
// @match        https://tnmap.tn.gov/assessment/beta/*
// @require      https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @require      https://cdn.jsdelivr.net/npm/@turf/turf@7/turf.min.js
// @require      https://update.greasyfork.org/scripts/509664/WME%20Utils%20-%20Bootstrap.js
// @grant        GM_xmlhttpRequest
// @license      GNU GPLv3
// ==/UserScript==

/* global bootstrap */

(async function main() {
    'use strict';

    const urlDomain = 'tnmap.tn.gov';
    const isArcgisMap = window.location.host.toLowerCase() === urlDomain;
    const scriptName = GM_info.script.name;

    class WmeCode {
        static mapWindow;
        static urlProtocol = 'https://';
        static urlPath = '/assessment/beta/';
        static windowName = 'tn_gis_map';
        static buttonId = 'tn-gis-button';
        static buttonTitle = 'Open the TN GIS map in a new window';
        static downloadUrl = 'https://update.greasyfork.org/scripts/369854/WME%20TN%20Parcel%20GIS%20Map.user.js';
        static sdk;

        static async init() {
            this.sdk = await bootstrap({ scriptUpdateMonitor: { downloadUrl: this.downloadUrl } });
            $('.WazeControlPermalink').prepend(
                $('<div>').css({ float: 'left', display: 'inline-block', padding: '0px 5px 0px 3px' }).append(
                    $('<a>', { id: this.buttonId, title: this.buttonTitle })
                        .text('TN-GIS')
                        .css({
                            float: 'left',
                            textDecoration: 'none',
                            color: '#000000',
                            fontWeight: 'bold'
                        })
                        .click(this.onButtonClick.bind(this))
                )
            );

            setInterval(() => {
                const $btn = $(`#${this.buttonId}`);
                if ($btn.length > 0) {
                    $btn.css('color', (this.mapWindow && !this.mapWindow.closed) ? '#1e9d12' : '#000000');
                }
            }, 1000);

            // SDK: Need to replace this with a moveend event.
            this.sdk.Events.on('wme-map-move', this.postMessage.bind(this));
        }

        static onButtonClick() {
            const url = this.urlProtocol + urlDomain + this.urlPath;
            if (!this.mapWindow || this.mapWindow.closed) {
                this.mapWindow = window.open(null, this.windowName);
                try {
                    if (this.mapWindow.location?.href) {
                        this.mapWindow.location.assign(url);
                        setTimeout(this.postMessage.bind(this), 2000);
                    }
                } catch (ex) {
                    if (ex.code === 18) {
                    // Ignore if accessing location.href is blocked by cross-domain.
                    } else {
                        throw ex;
                    }
                }
            }
            this.mapWindow.focus();
            setTimeout(this.postMessage.bind(this), 2000);
        }

        static postMessage() {
            if (this.mapWindow && !this.mapWindow.closed) {
                const centerPoint = this.sdk.Map.getMapCenter();
                const zoom = this.sdk.Map.getZoomLevel();
                try {
                    this.mapWindow.postMessage({
                        lon: centerPoint.lon,
                        lat: centerPoint.lat,
                        zoom
                    }, this.urlProtocol + urlDomain);
                } catch (ex) {
                    console.log(scriptName, ex);
                }
            }
        }
    }

    class GisMapCode {
        static waitingForDetailsToClose = false;
        static lastData = null;

        static init() {
            window.addEventListener('message', this.receiveMessageGIS.bind(this), false);
        }

        static buildUrl(data) {
            return `https://tnmap.tn.gov/assessment/beta/#/location/${data.lat}/${data.lon}/${data.zoom}`;
        }

        static receiveMessageGIS(event) {
            console.log(scriptName, event.data);
            const { data } = event;
            this.lastData = data;
            if (!window.location.href.includes('parcel')) {
                window.location.assign(this.buildUrl(data));
            } else if (!this.waitingForDetailsToClose) {
                this.waitingForDetailsToClose = true;
                this.updateLocationWhenDetailsClosed();
            }
        }

        static updateLocationWhenDetailsClosed() {
            if (window.location.href.includes('parcel')) {
                setTimeout(this.updateLocationWhenDetailsClosed.bind(this), 100);
            } else {
                window.location.assign(this.buildUrl(this.lastData));
                this.waitingForDetailsToClose = false;
            }
        }
    }

    if (isArcgisMap) {
        GisMapCode.init();
    } else {
        WmeCode.init();
    }
})();
