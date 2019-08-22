/*
 * Copyright (c) 2019 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2019 Tomas Machalek <tomas.machalek@gmail.com>
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

export interface TagBuilderBaseState {

    corpname:string;

    tagsetName:string;

    isBusy:boolean;

    canUndo:boolean;

    /**
     * An encoded representation of a tag selection. From CQL
     * point of view, this is just a string. Typically,
     * this can be used directly as a part of 'generatedQuery'.
     *
     * The value is used when user directly modifies an
     * existing tag within a CQL query. In such case, we
     * inject just the raw value.
     */
    rawPattern:string;

    /**
     * A valid CQL fragment directly applicable
     * within square brackets
     * "[EXPR_1 ... EXPR_K-1 RAW_PATTERN EXPR_K+1 ... EXPR_N]"
     *
     * This value is used when user inserts whole new tag expression.
     */
    generatedQuery:string;
}