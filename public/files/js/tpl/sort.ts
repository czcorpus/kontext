/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

import {PageModel} from './document';
import * as popupBox from '../popupbox';
import * as $ from 'jquery';
import * as kwicAlignUtils from '../kwicAlignUtils';


class SortPage {

    private layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private showLevelForm(elm, btn) {
        let closeLink;

        $(elm).show(100);
        closeLink = $('<a class="close-icon">'
            + '<img class="over-img" src="' + this.layoutModel.createStaticUrl('img/close-icon.svg')
            + '" data-alt-img="' + this.layoutModel.createStaticUrl('img/close-icon_s.svg') + '" />'
            + '</a>');
        closeLink.on('click', () => {
            $(elm).closest('td').nextAll('td').find('table.sort-level th.level a.close-icon').addClass('sync').trigger('click');

            if ($(elm).hasClass('sync')) {
                $(elm).hide(0);
                btn.show();
                this.setCurrentSortingLevel();

            } else {
                $(elm).hide(100, () => {
                    btn.show();
                    this.setCurrentSortingLevel();
                });
            }
        });

        if ($(elm).find('th.level a.close-icon').length === 0) {
            $(elm).find('th.level').append(closeLink);
        }
        btn.hide();
    }

    /**
     *
     */
    private setCurrentSortingLevel():void {
        $('input.sortlevel').val(1); // reset
        $('table.sort-level').each(function () {
            if ($(this).is(':visible')) {
                $('input.sortlevel').val($(this).attr('data-level'));
            }
        });
    }

    private updateForm():void {
        const self = this;
        let btnList = [null];

        $('select.sortlevel').closest('td').empty().append($('<input class="sortlevel" type="hidden" name="sortlevel" value="1" />'));
        $('table.sort-level').each(function (i, v) {
            let btn;

            if (i > 0) {
                btn = $(document.createElement('buttodocumentModn'));
                btn.attr('type', 'button');
                btn.addClass('add-level-button');
                btn.attr('title', self.layoutModel.translate('add_level'));
                btn.text(i + 1);
                $(v).hide();
                $(v).closest('td').append(btn);
                btn.on('click', function () {
                    self.showLevelForm(v, btn);
                    $.each(btnList, function (j) {
                        if (j < i && btnList[j] && btnList[j].is(':visible')) {
                            $(btnList[j]).trigger('click');
                        }
                    });
                    self.setCurrentSortingLevel();
                });
                btnList.push(btn);
            }
        });
    }

    /**
     *
     */
    init():void {
        this.layoutModel.init();
        kwicAlignUtils.extendKwicAlignmentSelector();
        $('a.kwic-alignment-help').each((i, elm) => {
            popupBox.bind($(elm), this.layoutModel.translate('global__this_applies_only_for_mk'), {
                'top': 'attached-bottom',
                'width': 'auto',
                'height': 'auto'
            });
        });
        $('a.backward-sort-help').each((i, elm) => {
            popupBox.bind($(elm), this.layoutModel.translate('global__sorting_backwards_explanation'), {
                'top': 'attached-bottom',
                'width': 'auto',
                'height': 'auto'
            });
        });
        this.updateForm();
    }

}


export function init(conf:Kontext.Conf):void {
    const layoutModel = new PageModel(conf);
    const pageModel = new SortPage(layoutModel);
    pageModel.init();
}