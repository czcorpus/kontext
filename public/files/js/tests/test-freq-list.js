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
        test('contains correct frequencies and words', function () {
            var
                expectedFreqs = [
                   '2,949', '2,536', '2,439', '1,617', '353', '349',
                   '308', '196', '136', '52', '14', '4', '4', '4', '3',
                   '3', '2', '2', '1', '1', '1', '1', '1'],
                jqTable = $('table.result').first(),
                actualFreqs = [],
                expectedWords = [
                    'dokument', 'dokumentů', 'dokumentu', 'Dokument', 'dokumentech', 'dokumentem', 'Dokumenty', 'dokumentům',
                    'DOKUMENT', 'DOKUMENTŮ', 'Dokumentů', 'Dokumentu', 'DOKUMENTY', 'Dokumentem', 'Dokumentech', 'DOKUMENTU',
                    'DOKUMENTECH', 'dokumentama', 'Dokumentům', 'Dokumentě', 'Dokumente', 'DOKUMENTů'
                ],
                actualWords = [];


           $(jqTable.find('tr.datarow td.frequency')).each(function () {
               actualFreqs.push(ts.util.stripString($(this).html()));
           });

           $(jqTable.find('tr.datarow td.word')).each(function () {
               actualWords.push(ts.util.stripString($(this).html()));
           });

            actualWords.push()

           deepEqual(actualFreqs, expectedFreqs);
       });
   });

   return ts;
});