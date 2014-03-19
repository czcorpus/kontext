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

define(['jquery', 'audioplayer', 'popupbox', 'win'], function ($, audioPlayer, popupBox, win) {
    'use strict';

    var lib = {};


    lib.currentDetail = null;


    function renderDetailFunc(data) {
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
    }

    /**
     * @return {jQuery} ajax notification box
     */
    function enableAjaxLoadingNotification(jqAjaxLoader) {
        jqAjaxLoader.css({
            'bottom' : '50px',
            'position' : 'fixed',
            'left' : ($(win).width() / 2 - 50) + 'px'
        });
        $('body').append(jqAjaxLoader);
    }

    /**
     *
     * @param {HTMLElement|jQuery} elm
     */
    function disableAjaxLoadingNotification(elm) {
        $(elm).remove();
    }

    /**
     * @param {HTMLElement|jQuery|string} eventTarget
     * @param {String} url
     * @param {{}} params
     * @param {Function} errorCallback
     * @param {jQuery} ajaxLoaderNotification
     */
    lib.showRefDetail = function (eventTarget, url, params, errorCallback, ajaxLoaderNotification) {
        enableAjaxLoadingNotification(ajaxLoaderNotification);

        $.ajax({
            url : url,
            type : 'GET',
            data : params,
            dataType : 'json',
            success: function (data) {
                var render = renderDetailFunc(data),
                    leftPos;

                disableAjaxLoadingNotification(ajaxLoaderNotification);
                if (lib.currentDetail) {
                    lib.currentDetail.close();
                }
                $(eventTarget).closest('tr').addClass('active');
                lib.currentDetail = popupBox.open(render, null, {
                    type : 'plain',
                    domId : 'detail-frame',
                    calculatePosition : false,
                    closeIcon : true,
                    timeout : null,
                    onClose : function () {
                        $('#conclines tr.active').removeClass('active');
                        lib.currentDetail = null;
                    }
                });
                leftPos = $(win).width() / 2 - lib.currentDetail.getPosition().width / 2;
                lib.currentDetail.setCss('left', leftPos + 'px');
            },

            error : function (jqXHR, textStatus, errorThrown) {
                disableAjaxLoadingNotification(ajaxLoaderNotification);
                errorCallback(jqXHR, textStatus, errorThrown);
            }
        });
    };

    /**
     * @param {HTMLElement|jQuery|string} eventTarget
     * @param {String} url
     * @param {{}} params
     * @param {Function} errorCallback
     * @param {Function} [callback] function called after the ajax's complete event is triggered
     * @param {jQuery} [ajaxLoaderNotification]
     */
    lib.showDetail = function (eventTarget, url, params, errorCallback, callback, ajaxLoaderNotification) {
        enableAjaxLoadingNotification(ajaxLoaderNotification);

        $.ajax({
            url : url,
            type : 'GET',
            data : params,
            success: function (data) {
                var leftPos;

                disableAjaxLoadingNotification(ajaxLoaderNotification);
                if (lib.currentDetail) {
                    lib.currentDetail.close();
                }

                $(eventTarget).closest('tr').addClass('active');

                lib.currentDetail = popupBox.open(data, null, {
                    type : 'plain',
                    domId : 'detail-frame',
                    calculatePosition : false,
                    closeIcon : true,
                    timeout : null,
                    onClose : function () {
                        $('#conclines tr.active').removeClass('active');
                        lib.currentDetail = null;
                    }
                });
                lib.currentDetail.setCss('width', '700px');
                leftPos = $(win).width() / 2 - lib.currentDetail.getPosition().width / 2;
                lib.currentDetail.setCss('left', leftPos + 'px');

                if (typeof callback === 'function') {
                    callback(lib.currentDetail);
                }
            },

            error : function (jqXHR, textStatus, errorThrown) {
                disableAjaxLoadingNotification(ajaxLoaderNotification);
                errorCallback(jqXHR, textStatus, errorThrown);
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