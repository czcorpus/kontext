/*
 * Copyright (c) 2013 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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


/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../types/common.d.ts" />

import $ = require('jquery');
import {PageModel} from './document';
import {bind as bindPopupBox} from '../popupbox';
import kwicAlignUtils = require('../kwicAlignUtils');


class FreqPage {

    private layoutModel:PageModel;

    private maxNumLevels:number = 1;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }


    private recalcLevelParams():void {
        $('#multilevel-freq-params tr.level-line').each((i, elm:HTMLElement) => {
            let currLevel = i + 1;

            if (currLevel === 1) {
                return;
            }
            $(elm).find('td:first').text(currLevel + '.');
            $(elm).find('td:nth-child(2) select').attr('name', 'ml' + currLevel + 'attr');
            $(elm).find('td:nth-child(3) input').attr('name', 'ml' + currLevel + 'icase');
            $(elm).find('td:nth-child(4) select').attr('name', 'ml' + currLevel + 'ctx');
            $(elm).find('td:nth-child(5) select').attr('id', 'kwic-alignment-' + currLevel);
            $(elm).find('td input[name="freqlevel"]').val(currLevel);
        });

        let addLevelButton = $('#add-freq-level-button');
        if (!addLevelButton.is(':visible') && this.getCurrNumLevels() < this.maxNumLevels) {
            addLevelButton.show();
        }
        kwicAlignUtils.extendKwicAlignmentSelector();
    }

    private getCurrNumLevels():number {
        return $('#multilevel-freq-params tr.level-line').length;
    }

    private addLevel():void {
        let numLevels = this.getCurrNumLevels();
        let newLine = $('#multilevel-freq-first-level').clone();
        let newLevelNum = numLevels + 1;

        $('#multilevel-freq-params tr.add-level').before(newLine);
        newLine.attr('id', null);
        newLine.find('td:first').text(newLevelNum + '.');
        newLine.find('td:nth-child(2) select').attr('name', 'ml' + newLevelNum + 'attr');
        newLine.find('td:nth-child(3) input').attr('name', 'ml' + newLevelNum + 'icase');
        newLine.find('td:nth-child(4) select').attr('name', 'ml' + newLevelNum + 'ctx');
        newLine.find('td:nth-child(5) select').attr('id', 'kwic-alignment-' + newLevelNum);
        newLine.find('td input[name="freqlevel"]').val(newLevelNum);
        // close icon
        let title = this.layoutModel.translate('global__remove_item');
        let imgSrc = this.layoutModel.createStaticUrl('img/close-icon.svg');
        let imgSrc2 = this.layoutModel.createStaticUrl('img/close-icon_s.svg');
        newLine.find('td:last')
            .empty()
            .append(
                '<a class="remove-level" title="' + title + '">' +
                '<img class="over-img" src="' + imgSrc + '" alt="' + title + '"' +
                    ' data-alt-img="' + imgSrc2 + '" /></a>');
        this.layoutModel.mouseOverImages(newLine);

        newLine.find('td:last a.remove-level').on('click', (event) => {
            this.removeLevel($(event.target).closest('tr'));
        });
        if (this.getCurrNumLevels() === this.maxNumLevels) {
            $('#add-freq-level-button').hide();
        }
        kwicAlignUtils.extendKwicAlignmentSelector(newLine.get(0));
    }

    private removeLevel(lineElm):void {
        lineElm.remove();
        this.recalcLevelParams();
    }

    private bindEvents():void {
        $('#add-freq-level-button').on('click', () => {
            this.addLevel();
        });
    }

    init() {
        this.layoutModel.init();
        this.maxNumLevels = this.layoutModel.getConf<number>('multilevel_freq_dist_max_levels');
        kwicAlignUtils.extendKwicAlignmentSelector();
        const lastNumLevels = this.layoutModel.getConf<number>('lastNumLevels');
        if (lastNumLevels) {
            for (let i = 1; i < lastNumLevels; i += 1) {
                this.addLevel();
            }
        }

        $('a.kwic-alignment-help').each((_, elm:HTMLElement) => {
            bindPopupBox(
                $(elm),
                this.layoutModel.translate('global__this_applies_only_for_mk'),
                {
                    top: 'attached-bottom',
                    width: 'auto',
                    height: 'auto'
                }
            );
        });
        this.bindEvents();

        // "Node start at" function
        $('#multilevel-freq-first-level .kwic-alignment-box').css('display', 'block');
    }
}


export function init(conf:Kontext.Conf):void {
    let page = new FreqPage(new PageModel(conf));
    page.init();
}