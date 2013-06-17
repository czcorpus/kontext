/*
 * Copyright (c) 2012 Czech National Corpus
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

define(['jquery', 'test-suite'], function ($, ts) {

    ts.add(function () {

        test('contains correct corpus name', function () {
            equal(ts.util.stripString($('a#corpus-desc-link strong').text()), 'syn2010');
        });

        test('contains correct number of positions', function () {
            equal(ts.util.stripString($('td#toolbar-info ul li strong.corpus-size').text()), '121,667,413 positions');
        });

        test('contains hierarchical corpus selector', function () {
            var elm = $("form#mainform button[type='button']"),
                searchedText;

            equal(elm.text(), 'syn2010');

            searchedText = $('ul.tree-component li').first().text();
            equal(searchedText.indexOf('Synchronní psané korpusy') > -1, true);

            elm.click(); // now the menu should be seen
            equal($('ul.tree-component').css('display'), 'block');
            elm.click(); // and now it should be hidden again
            equal($('ul.tree-component').css('display'), 'none');
        });

        test('contains working query type selector', function () {
            equal($('#tagrow').hasClass('hidden'), true, '#tagrow is hidden');
            $('#queryselector').val('tagrow');
            $('#queryselector').change();
            equal($('#tagrow').hasClass('visible'), true, '#tagrow is visible');
        });
    });

    return ts;

});