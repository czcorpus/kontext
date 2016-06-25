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

define(['jquery', 'popupbox', 'win'], function ($, popupBox, win) {
    'use strict';

    var lib = {};


    lib.currentDetail = null;


    function renderDetailFunc(data, layoutModel) {
        return function (tooltipBox, finalize) {
            var i = 0,
                j,
                html,
                currRefs,
                step,
                parentElm = tooltipBox.getRootElement();

            function refRender() {
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
            }

            if (data['Refs']) {
                if (data.Refs.length > 8) {
                    step = 2;

                } else {
                    step = 1;
                }

                html = '<table class="full-ref">';
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

            } else {
                html += '<tr><td>' + layoutModel.translate('global__no_data_found') + '</td></tr>';
            }
            $(parentElm).html(html);
            finalize();
        };
    }

    /**
     * @return {jQuery} ajax notification box
     */
    function enableAjaxLoadingNotification(jqAjaxLoader) {
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
     */
    lib.showRefDetail = function (url, params, layoutModel, succCallback, closeCallback, errorCallback) {
        var ajaxLoader = layoutModel.createAjaxLoader();

        enableAjaxLoadingNotification(ajaxLoader);

        $.ajax({
            url : url,
            type : 'GET',
            data : params,
            dataType : 'json',
            success: function (data) {
                var render = renderDetailFunc(data, layoutModel),
                    leftPos;

                disableAjaxLoadingNotification(ajaxLoader);
                if (lib.currentDetail) {
                    lib.currentDetail.close();
                }

                lib.currentDetail = popupBox.open(render, null, {
                    type : 'plain',
                    domId : 'detail-frame',
                    calculatePosition : false,
                    closeIcon : true,
                    timeout : null,
                    onClose : function () {
                        if (typeof closeCallback === 'function' ) {
                            closeCallback();
                        }
                        lib.currentDetail = null;
                    }
                });
                leftPos = $(win).width() / 2 - lib.currentDetail.getPosition().width / 2;
                lib.currentDetail.setCss('left', leftPos + 'px');
                succCallback();
            },

            error : function (jqXHR, textStatus, errorThrown) {
                disableAjaxLoadingNotification(ajaxLoader);
                errorCallback(jqXHR, textStatus, errorThrown);
            }
        });
    };

    function attachDisplayWholeDocumentTrigger(layoutModel, tooltipBox, triggerElm) {
        var url = layoutModel.createActionUrl($(triggerElm).data('action')) + '?' + $(triggerElm).data('params');
        var prom = $.ajax(url, { type : 'GET' });
        $(tooltipBox.getContentElement())
            .empty()
            .append('<img src="' + layoutModel.createStaticUrl('img/ajax-loader.gif')
                    + '" class="ajax-loader" />');
        prom.then(
            function (data) {
                $(tooltipBox.getContentElement())
                    .addClass('whole-document')
                    .empty()
                    .html(data);
            },
            function (err) {
                layoutModel.showMessage('error', err);
            }
        );
    }

    /**
     */
    lib.showDetail = function (url, params, layoutModel, onSuccess, onClose, onError) {

        $.ajax({
            url : url,
            type : 'GET',
            data : params,
            success: function (data) {
                var leftPos;

                if (lib.currentDetail) {
                    lib.currentDetail.close();
                }
                lib.currentDetail = popupBox.extended(layoutModel.pluginApi()).open(data, null, {
                    type : 'plain',
                    domId : 'detail-frame',
                    calculatePosition : false,
                    closeIcon : true,
                    timeout : null,
                    onClose : function () {
                        if (typeof onClose === 'function' ) {
                            onClose();
                        }
                        lib.currentDetail = null;
                    },
                    onShow : function () {
                        var self = this;
                        $('#ctx-link').on('click', function (evt) {
                            attachDisplayWholeDocumentTrigger(layoutModel, self, evt.target);
                        });
                    }
                });
                lib.currentDetail.setCss('width', '700px');
                leftPos = $(win).width() / 2 - lib.currentDetail.getPosition().width / 2;
                lib.currentDetail.setCss('left', leftPos + 'px');

                if (typeof onSuccess === 'function') {
                    onSuccess(lib.currentDetail);
                }
            },

            error : function (jqXHR, textStatus, errorThrown) {
                if (typeof onError === 'function') {
                    onError(jqXHR, textStatus, errorThrown);
                }
            }
        });
    };

    return lib;
});