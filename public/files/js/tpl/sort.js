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

define(['tpl/document', 'popupbox', 'jquery', 'kwicAlignUtils'], function (layoutModel, popupBox, $, kwicAlignUtils) {
    'use strict';

    var lib = {};

    function showLevelForm(elm, btn) {
        var closeLink;

        $(elm).show(100);
        closeLink = $('<a class="close-icon">'
            + '<img class="over-img" src="../files/img/close-icon.png" data-alt-img="../files/img/close-icon_s.png" />'
            + '</a>');
        closeLink.on('click', function () {
            $(elm).closest('td').nextAll('td').find('table.sort-level th.level a.close-icon').addClass('sync').trigger('click');

            if ($(elm).hasClass('sync')) {
                $(elm).hide(0);
                btn.show();
                setCurrentSortingLevel();

            } else {
                $(elm).hide(100, function () {
                    btn.show();
                    setCurrentSortingLevel();
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
     * @param {function} [listMod]
     */
    function setCurrentSortingLevel() {

        $('input.sortlevel').val(1); // reset
        $('table.sort-level').each(function () {
            if ($(this).is(':visible')) {
                $('input.sortlevel').val($(this).attr('data-level'));
            }
        });
    }

    lib.updateForm = function () {
        var btnList = [null];

        $('select.sortlevel').closest('td').empty().append($('<input class="sortlevel" type="hidden" name="sortlevel" value="1" />'));
        $('table.sort-level').each(function (i, v) {
            var btn;

            if (i > 0) {
                btn = $(document.createElement('button'));
                btn.attr('type', 'button');
                btn.addClass('add-level-button');
                btn.attr('title', layoutModel.translate('add_level'));
                btn.text(i + 1);
                $(v).hide();
                $(v).closest('td').append(btn);
                btn.on('click', function () {
                    showLevelForm(v, btn);
                    $.each(btnList, function (j) {
                        if (j < i && btnList[j] && btnList[j].is(':visible')) {
                            $(btnList[j]).trigger('click');
                        }
                    });
                    setCurrentSortingLevel();
                });


                btnList.push(btn);
            }
        });
    };

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        layoutModel.init(conf);
        kwicAlignUtils.fix();
        $('a.kwic-alignment-help').each(function () {
            popupBox.bind($(this), layoutModel.conf.messages.msg, {
                'top': 'attached-bottom',
                'width': 'auto',
                'height': 'auto'
            });
        });

        lib.updateForm();
    };

    return lib;
});