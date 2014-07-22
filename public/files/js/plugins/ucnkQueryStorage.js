/*
 * Copyright (c) 2014 Institute of the Czech National Corpus
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

/**
 * A widget to extend CQL query input field by a pop-up box containing user's query history.
 */
define(['jquery', 'win'], function ($, win) {
    'use strict';

    var lib = {};

    lib.pluginApi = null; // this must be initialized via lib.init(plugInApi)

    /**
     *
     * @param inputElm
     * @param parentElm
     * @constructor
     */
    function Plugin(inputElm, parentElm) {
        this.inputElm = $(inputElm);
        this.parentElm = $(parentElm);
        this.boxElm = null;
        this.inputElm.attr('autocomplete', 'off');
        this.highlightedRow = 0;
        this.data = []; // currently appended data
        this.dependencies = []; // list of registered external dependencies (see function registerDependency())
        this.bindOnOffEvents();
    }

    /**
     *
     * @param refElm
     * @returns {{width: number, height: number, top: number, left: number}}
     */
    Plugin.prototype.calcSizeAndPosition = function (refElm) {
        var jqRef = $(refElm);
        return {
            width : jqRef.width(),
            height : jqRef.outerHeight(),
            top : jqRef.position().top,
            left : jqRef.position().left
        };
    };

    /**
     *
     * @returns {*}
     */
    Plugin.prototype.inputVisible = function () {
        return this.inputElm.is(':visible');
    };

    /**
     *
     * @returns {Number}
     */
    Plugin.prototype.numRows = function () {
        return this.data ? this.data.length : 0;
    };

    /**
     *
     * @param val
     */
    Plugin.prototype.setInputVal = function (val) {
        this.inputElm.val(val);
    };

    /**
     *
     */
    Plugin.prototype.popup = function () {
        if (!this.isActive()) {
            this.init();
        }
    };

    /**
     *
     */
    Plugin.prototype.bindOnOffEvents = function () {
        var self = this;

        $(win).on('keyup.queryStoragePlugin', function (event) {
            if (event.keyCode === 13 || (event.keyCode === 27 && self.isActive())) { // ENTER or ESC key
                event.preventDefault();
                event.stopPropagation();
                self.close();

            } else if (event.keyCode === 40 && self.inputVisible()
                    && !self.isActive() && self.inputHasFocus()) {
                self.popup();
            }
        });
    };

    /**
     *
     */
    Plugin.prototype.bindEvents = function () {
        var self = this;

        this.inputElm.on('keyup.queryStoragePluginMoveSelection', function (event) {
            if (event.keyCode === 38) { // UP arrow
                self.highlightPrevRow();

            } else if (event.keyCode === 40 && self.isActive()) { // DOWN arrow
                self.highlightNextRow();
            }
        });

        this.boxElm.find('.filter-checkbox').on('click', function (event) {
            if ($(event.currentTarget).is(':checked')) {
                self.boxElm.find('.rows li').each(function () {
                    if ($(this).data('corpname') !== lib.pluginApi.conf.corpname) {
                        $(this).hide();
                    }
                });

            } else {
                self.boxElm.find('.rows li').each(function () {
                    if ($(this).data('corpname') !== lib.pluginApi.conf.corpname
                            && !$(this).is(':visible')) {
                        $(this).show();
                    }
                });
            }
        });

        // we have to block main form Enter key event to prevent submission
        $('#make-concordance-button').attr('disabled', 'disabled');
    };

    /**
     *
     */
    Plugin.prototype.cleanRowSelection = function () {
        this.boxElm.find('ul.rows li').removeClass('selected');
    };

    /**
     *
     */
    Plugin.prototype.highlightCurrentRow = function () {
        this.cleanRowSelection();
        if (this.data.length > 0) {
            this.boxElm.find('ul.rows li:nth-child(' + (this.highlightedRow + 1) + ')').addClass('selected');
            this.setInputVal(this.data[this.highlightedRow].query);
        }
    };

    /**
     *
     */
    Plugin.prototype.highlightNextRow = function () {
        if (this.highlightedRow < this.numRows() - 1) {
            this.highlightedRow += 1;
            this.highlightCurrentRow();
        }
    };

    /**
     *
     */
    Plugin.prototype.highlightPrevRow = function () {
        if (this.highlightedRow > 0) {
            this.highlightedRow -= 1;
            this.highlightCurrentRow();
        }
    };

    /**
     * @typedef {object} Closeable
     * @property {function} close
     */

    /**
     * @param {Closeable} dep
     */
    Plugin.prototype.registerDependency = function (dep) {
        if (typeof dep.close !== 'function') {
            throw new Error('Registered dependency must implement close() method');
        }
        this.dependencies.push(dep);
    };

    /**
     *
     */
    Plugin.prototype.closeDependencies = function () {
        var i;

        for (i = 0; i < this.dependencies.length; i += 1) {
            try {
                this.dependencies[i].close();
            } catch (e) {
                console.error('error closing dependency: ', e);
            }
        }
    };

    /**
     *
     */
    Plugin.prototype.init = function () {
        var self = this,
            prom;

        if (this.data.length === 0) {
            if (this.inputElm.val()) {
                this.data.push({
                    query : this.inputElm.val(),
                    query_type : $('#queryselector option:selected').data('type'),
                    corpname : lib.pluginApi.conf.corpname,
                    subcorpname : self.getCurrentSubcorpname(),
                    humanCorpname : lib.pluginApi.conf.humanCorpname
                });
            }
            this.inputElm.blur();  // These two lines prevent Firefox from deleting
            this.inputElm.focus(); // the input after ESC is hit (probably a bug).

            prom = $.ajax('ajax_query_history', {
                dataType : 'json'
            }).promise();

            prom.then(
                function (data) {
                    if (data.hasOwnProperty('error')) {
                        lib.pluginApi.showMessage('error', data.error);

                    } else {
                        if (!this.boxElm) {
                            self.render();
                        }
                        self.showData(data.data);
                    }
                },
                function (err) {
                    lib.pluginApi.showMessage('error', err.statusText);
                }
            );

        } else { // data are already loaded - let's just reuse it
            if (!this.boxElm) {
                self.render();
            }
            this.showData();
        }
    };

    /**
     *
     */
    Plugin.prototype.render = function () {
        var frame = this.calcSizeAndPosition(this.inputElm),
            html;

        html = '<ul class="rows"></ul>'
             + '<div class="footer">'
             + '<label class="filter-current">'
             + lib.pluginApi.translate('current corpus only')
             + '<input class="filter-checkbox" type="checkbox" /></label>'
             + '</div>';

        this.boxElm = $('<div>');
        this.boxElm.addClass('history-widget');
        $(this.parentElm).append(this.boxElm);
        this.boxElm.css({
            position : 'absolute',
            left : frame.left,
            top : frame.top + frame.height,
            width : frame.width
        });
        this.boxElm.html(html);
        this.bindEvents();
    };

    /**
     * Cleans-up currently rendered history rows and appends new data
     * as obtained in parameter 'data'. This method has a side effect
     * as it sets this.data to the new value. If no 'data' is provided
     * then current this.data value is used.
     *
     * @param {{}} [data]
     * @param {string} data.humanCorpname
     * @param {string} data.subcorpname
     * @param {string} data.corpname
     */
    Plugin.prototype.showData = function (data) {
        var tbl = this.boxElm.find('ul.rows'),
            listItem,
            link,
            self = this;

        if (typeof data !== 'undefined') {
            this.data = data;
        }
        tbl.empty();
        $.each(this.data, function (i, v) {
            var subcorpSuff = v.subcorpname ? ':' + v.subcorpname : '';

            listItem = $(win.document.createElement('li'));
            listItem.attr('data-rownum', i);
            listItem.attr('data-corpname', v.corpname);
            listItem.attr('data-subcorpname', v.subcorpname);
            listItem.attr('data-query-type', v.query_type);

            link = $(win.document.createElement('em'));
            link.attr('href', v.url);
            link.append(v.query);

            listItem.on('click', function (event) {
                var triggerElm = $(this);

                self.highlightedRow = parseInt(triggerElm.attr('data-rownum'), 10);
                self.highlightCurrentRow();
                self.setInputVal(self.data[self.highlightedRow].query);
                if (triggerElm.attr('data-subcorpname')) {
                    self.updateSubcorpSelector(triggerElm.attr('data-subcorpname'));
                }
                if (triggerElm.attr('data-query-type')) {
                    self.setQueryType(triggerElm.attr('data-query-type'));
                }
                event.preventDefault();
                event.stopPropagation();
                self.close();
            });

            tbl.append(listItem);
            listItem.append(link);
            listItem.append('&nbsp;<span class="corpname">(' + v.query_type + ', ' + v.humanCorpname + subcorpSuff + ')</span>');
        });
        this.highlightCurrentRow();
    };

    /**
     * Closes history widget.
     */
    Plugin.prototype.close = function () {
        this.inputElm.off('keyup.queryStoragePluginMoveSelection');
        this.highlightedRow = 0;
        if (this.boxElm) {
            this.boxElm.remove();
            this.boxElm = null;
        }
        $('#make-concordance-button').attr('disabled', null);
    };

    /**
     *
     * @returns {boolean}
     */
    Plugin.prototype.isActive = function () {
        return this.boxElm !== null;
    };

    /**
     * @return {boolean}
     */
    Plugin.prototype.inputHasFocus = function () {
        return this.inputElm.is(':focus');
    };

    /**
     *
     * @param {string} queryType
     */
    Plugin.prototype.setQueryType = function (queryType) {
        $('#queryselector').val(queryType + 'row');
        $('#queryselector').change(); // to trigger proper event
    };

    /**
     *
     * @param {string} name
     */
    Plugin.prototype.updateSubcorpSelector = function (name) {
        $('#subcorp-selector').val(name);
    };

    /**
     *
     * @returns {val|*|val}
     */
    Plugin.prototype.getCurrentSubcorpname = function () {
        return $('#subcorp-selector').val();
    };

    /**
     *
     * @returns {*|HTMLElement}
     */
    Plugin.prototype.getWrappingElement = function () {
        return this.parentElm;
    };

    /**
     * @param {Plugin} plugin
     */
    lib.addTriggerButton = function (plugin) {
        var liElm,
            aElm;

        if (plugin) {
            liElm = $('<li></li>');
            aElm = $('<a class="history"></a>');
            aElm.css('text-transform', 'lowercase');

            plugin.getWrappingElement().find('.query-toolbox').append(liElm);
            liElm.append(aElm);
            aElm.append(lib.pluginApi.translate('Recent queries'));
            aElm.on('click', function () {
                if (plugin.isActive()) {
                    plugin.close();

                } else {
                    plugin.popup();
                }
            });
            plugin.registerDependency({
                element : aElm,
                close : function () {
                    $(aElm).remove();
                }
            });
        }
    };

    /**
     * Binds the query history widget to a passed element (typically, this is an input elm)
     *
     * @param elm
     * @returns {Plugin}
     */
    lib.bind = function (elm) {
        var plugin;

        if (Object.prototype.toString.call(lib.pluginApi) !== '[object Object]') {
            throw new Error('Plugin [ucnkQueryStorage] not initialized. Please call init() first.');
        }

        plugin = new Plugin(elm, $(elm).parent());
        $(elm).data('plugin', plugin);

        return plugin;
    };

    /**
     * Detaches plugin instance from provided element.
     * All the event handlers are removed too.
     *
     * @param {jQuery|HTMLElement} elm
     */
    lib.detach = function (elm) {
        elm = $(elm);
        if (elm.data('plugin') !== null && typeof elm.data('plugin') === 'object') {
            elm.data('plugin').close();
            elm.data('plugin').closeDependencies();
            $(win).off('keyup.queryStoragePlugin');
            elm.data('plugin', null);
        }
    };

    lib.reset = function () {
        if (!lib.pluginApi.conf.anonymousUser) {
            $('input.history:visible').each(function () {
                var plugin = lib.bind(this);
                lib.addTriggerButton(plugin);
            });
        }
    };

    /**
     *
     * @param pluginApi
     */
    lib.init = function (pluginApi) {
        lib.pluginApi = pluginApi;
        this.reset();
    };

    return lib;
});