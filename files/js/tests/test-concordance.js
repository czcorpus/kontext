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

define(['module', 'jquery', 'test-suite'], function (module, $, ts) {

    ts.add(function () {

        ts.module(module.id);

        test( "Correct number of hits on lemma 'dokument'", function() {
            equal(ts.util.stripString($('div#result-info strong').first().text()), '10,976');
        });

        test ("Correct i.p.m. on 'dokument'", function () {
            equal(ts.util.stripString($('div#result-info span.ipm').first().text()), '90.21');
        });
    });

    return ts;
});