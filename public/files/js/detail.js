/*
 * Copyright (c) 2013 Institute of the Czech National Corpus
 * Copyright (c) 2003-2009  Pavel Rychly
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * dated June, 1991.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

define(['jquery', 'audioplayer', 'popupbox'], function ($, audioPlayer, popupBox) {
    'use strict';

    var lib = {},
        renderDetailFunc;


    lib.currentDetail = null;

    renderDetailFunc = function (data) {
        return function (tooltipBox, finalize) {
            var i = 0,
                j,
                html = '<table class="full-ref">',
                currRefs,
                step,
                parentElm = tooltipBox.getRootElement(),
                refRender;

            if (data.Refs.length > 8) {
                step = 2;

            } else {
                step = 1;
            }

            refRender = function () {
                if (this.name) {
                    html += '<th>' + this.name + ':</th><td class="data">';
                    if (/https?:\/\//.exec(this.val)) {
                        html += '<a href="' + this.val + '">' + this.val + '</a>';

                    } else {
                        html += this.val;
                    }
                    html += '</td>';

                } else {
                    html += '<th></th><td></td>';
                }
            };

            while (i < data.Refs.length) {
                currRefs = [];
                for (j = 0; j < step; j += 1) {
                    if (data.Refs[i + j]) {
                        currRefs.push(data.Refs[i + j]);

                    } else {
                        currRefs.push({name: null, val: null});
                    }
                }
                html += '<tr>';

                $.each(currRefs, refRender);
                html += '</tr>';
                i += step;
            }
            html += '</table>';

            $(parentElm).html(html);
            finalize();
        };
    };

    /**
     *
     * @param {String} url
     * @param {{}} params
     */
    lib.showRefDetail = function (url, params) {
        $.ajax({
            url : url,
            type : 'GET',
            data : params,
            dataType : 'json',
            success: function (data) {
                var render = renderDetailFunc(data),
                    leftPos;

                if (lib.currentDetail) {
                    lib.currentDetail.close();
                }
                lib.currentDetail = popupBox.open(render, null, {
                    type : 'plain',
                    domId : 'detail-frame',
                    calculatePosition : false,
                    timeout : null,
                    onClose : function () {
                        $('#conclines tr.active').removeClass('active');
                        lib.currentDetail = null;
                    }
                });
                leftPos = $(window).width() / 2 - lib.currentDetail.getPosition().width / 2;
                lib.currentDetail.setCss('left', leftPos + 'px');
            }
        });
    };

    /**
     *
     * @param {String} url
     * @param {{}} params
     * @param {Function} [callback] function called after the ajax's complete event is triggered
     */
    lib.showDetail = function (url, params, callback) {
        $.ajax({
            url : url,
            type : 'GET',
            data : params,
            success: function (data) {
                var leftPos;

                if (lib.currentDetail) {
                    lib.currentDetail.close();
                }

                lib.currentDetail = popupBox.open(data, null, {
                    type : 'plain',
                    domId : 'detail-frame',
                    calculatePosition : false,
                    timeout : null,
                    onClose : function () {
                        $('#conclines tr.active').removeClass('active');
                        lib.currentDetail = null;
                    }
                });
                lib.currentDetail.setCss('width', '700px');
                leftPos = $(window).width() / 2 - lib.currentDetail.getPosition().width / 2;
                lib.currentDetail.setCss('left', leftPos + 'px');

                if (typeof callback === 'function') {
                    callback(lib.currentDetail);
                }
            }
        });
    };

    /**
     *
     * @param linkElem
     */
    lib.openSpeech = function (linkElem) {
        var speechURL = $(linkElem).attr('href');
        audioPlayer.create('audio-wrapper', linkElem, { volume : 90 }).play(speechURL);
    };

    return lib;
});