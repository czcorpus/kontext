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
     * @param {HTMLElement|jQuery|string} eventTarget
     * @param {String} url
     * @param {{}} params
     * @param {Function} errorCallback
     * @param {PageModel} layoutModel
     */
    lib.showRefDetail = function (eventTarget, url, params, errorCallback, layoutModel) {
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
                $(eventTarget).closest('tr').addClass('active');
                $('#conclines tr.prev-active').removeClass('prev-active');

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
     * @param {HTMLElement|jQuery|string} eventTarget
     * @param {String} url
     * @param {{}} params
     * @param layoutModel
     * @param {Function} [callback] function called after the ajax's complete event is triggered
     */
    lib.showDetail = function (eventTarget, url, params, layoutModel, callback) {

        function errorHandler(jqXHR, textStatus, error) {
            layoutModel.showMessage('error', error);
        }
        var ajaxAnim = layoutModel.createAjaxLoader();
        enableAjaxLoadingNotification(ajaxAnim);

        $.ajax({
            url : url,
            type : 'GET',
            data : params,
            success: function (data) {
                var leftPos;

                disableAjaxLoadingNotification(ajaxAnim);
                if (lib.currentDetail) {
                    lib.currentDetail.close();
                }

                if (!$(eventTarget).hasClass('expand-link')) {
                    $('#conclines tr.prev-active').removeClass('prev-active');
                    $(eventTarget).closest('tr').addClass('active');

                } else {
                    $('#conclines tr.prev-active').removeClass('prev-active').addClass('active');
                }
                lib.currentDetail = popupBox.extended(layoutModel.pluginApi()).open(data, null, {
                    type : 'plain',
                    domId : 'detail-frame',
                    calculatePosition : false,
                    closeIcon : true,
                    timeout : null,
                    onClose : function () {
                        $('#conclines tr.active').removeClass('active').addClass('prev-active');
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

                if (typeof callback === 'function') {
                    callback(lib.currentDetail);
                }
            },

            error : function (jqXHR, textStatus, errorThrown) {
                disableAjaxLoadingNotification(ajaxAnim);
                errorHandler(jqXHR, textStatus, errorThrown);
            }
        });
    };

    return lib;
});