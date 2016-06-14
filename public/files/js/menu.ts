/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

/// <reference path="../ts/declarations/jquery.d.ts" />
/// <reference path="../ts/declarations/rsvp.d.ts" />
/// <reference path="../ts/declarations/popupbox.d.ts" />
/// <reference path="./types/common.d.ts" />

import $ = require('jquery');
import RSVP = require('vendor/rsvp');
import popupbox = require('popupbox');
import win = require('win');

/**
 * KonText main menu
 */
export class MainMenu {

    /**
     * Wrapping element for whole main-menu
     */
    jqMenuBar:JQuery;

    private activeSubmenu:HTMLElement;

    private layoutModel:Kontext.PluginApi;


    constructor(layoutModel:Kontext.PluginApi) {
        this.layoutModel = layoutModel;
        this.jqMenuBar = $('#menu-bar');
    }

    getActiveSubmenu():HTMLElement {
        return this.activeSubmenu;
    }

    /**
     * @param {string} id
     */
    setActiveSubmenu(submenu:HTMLElement) {
        this.activeSubmenu = submenu;
    }

    /**
     * @param {string} [menuId]
     */
    closeSubmenu(menuId?) {
        if (this.activeSubmenu) {
            $(this.activeSubmenu).css('display', 'none');
            $(this.activeSubmenu).closest('li').removeClass('active');
            this.activeSubmenu = null;
        }
    }

    /**
     *
     * @param li
     * @returns {*}
     */
    private getHiddenSubmenu(li):JQuery {
        return $(li).find('ul');
    }

    private initCustomHelp():void {
        let self = this;
        let jqSubmenu = $('#menu-help').find('ul.submenu');
        let liElm = window.document.createElement('li');
        let aElm = window.document.createElement('a');

        jqSubmenu.append(liElm);
        $(aElm).text(this.layoutModel.translate('global__how_to_cite_corpus'));
        $(liElm)
            .addClass('separ')
            .append(aElm);

        function createContents(tooltipBox, finalize) {
            tooltipBox.setCss('top', '25%');
            tooltipBox.setCss('left', '20%');
            tooltipBox.setCss('width', '60%');
            tooltipBox.setCss('height', 'auto');

            let prom:RSVP.Promise<any> = self.layoutModel.ajax<any>(
                'GET',
                self.layoutModel.createActionUrl('corpora/ajax_get_corp_details'),
                {
                    'corpname': self.layoutModel.getConf('corpname')
                },
                {
                    contentType : 'application/x-www-form-urlencoded'
                }
            );

            prom.then(
                function (data) {
                    self.layoutModel.renderReactComponent(
                        self.layoutModel.getViews().CorpusReference,
                        tooltipBox.getRootElement(),
                        {
                            citation_info: data['citation_info'] || {},
                            doneCallback: finalize.bind(self)
                        }
                    );
                },
                function (err) {
                    self.layoutModel.showMessage('error', err);
                }
            );
        }

        $(aElm).on('click', () => {
                this.closeSubmenu();
                popupbox.open(
                    createContents,
                    null,
                    {
                        type: 'plain',
                        closeIcon: true,
                        timeout: null,
                        calculatePosition : false,
                        onClose: function () {
                            self.layoutModel.unmountReactComponent(this.getRootElement());
                        }
                    }
                );
            }
        );
    }

    /**
     *
     * @param activeLi - active main menu item LI
     */
    private openSubmenu(activeLi:JQuery) {
        var menuLeftPos;
        var jqSubMenuUl;
        var jqActiveLi = $(activeLi);
        var rightmostPos;

        jqSubMenuUl = this.getHiddenSubmenu(jqActiveLi);
        if (jqSubMenuUl.length > 0) {
            jqActiveLi.addClass('active');
            jqSubMenuUl.css('display', 'block');
            rightmostPos = jqSubMenuUl.offset().left + jqSubMenuUl.width();
            if (rightmostPos > $(window).width()) {
                menuLeftPos = - (rightmostPos - $(window).width());

            } else {
                menuLeftPos = 0;
            }
            jqSubMenuUl.css('left', menuLeftPos);
            this.activeSubmenu = jqSubMenuUl.get(0);
        }
    }

    /**
     * Initializes main menu logic
     */
    init():void {
        var self = this;

        if (this.layoutModel.getConf('corpname')) {
            this.initCustomHelp();
        }

        $('#menu-level-1 li.disabled a').each(function () {
            $(this).attr('href', '#');
        });

        $('#menu-level-1 a.trigger').each(function () {
            $(this).on('mouseover', function (event) {
                var jqMenuLi = $(event.target).closest('li'),
                    prevMenu:HTMLElement,
                    newMenu = jqMenuLi.get(0);

                prevMenu = self.getActiveSubmenu();
                if (prevMenu !== newMenu) {
                    self.closeSubmenu(prevMenu);

                    if (!jqMenuLi.hasClass('disabled')) {
                        self.setActiveSubmenu(jqMenuLi.get(0));
                        self.openSubmenu(jqMenuLi);
                    }
                }
            });
        });

        self.jqMenuBar.on('mouseleave', function (event) {
            self.closeSubmenu(self.getActiveSubmenu());
        });

        $(win).on('resize', function () {
            self.closeSubmenu();
        });

        popupbox.abbr();
    }

}