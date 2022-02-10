/*
 * Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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


export interface Props {
    /**
     * The content to be shown inside a PopupBox when clicked.
     */
    children:React.ReactNode;

    /**
     * If true then the icon is rather an exclamation mark (instead
     * of the default question mark) and additional tooltips/mouseovers
     * are also slightly different to match the "seriousness" of the message.
     */
    isWarning?:boolean;

    /**
     * By default the icon is displayed within the <sup> element. This
     * setting can switch it to a standard <span>.
     */
    noSuperscript?:boolean;

    /**
     * Custom style for the PopupBox (this is directly passed to its
     * customStyle property)
     */
    customStyle?:{[key:string]:string};

    /**
     * If defined, then the widget also displays a clickable link
     * (typically for more detailed info)
     */
    url?:string;
}

export interface State {
    helpVisible:boolean;
}

export type Component = React.FC<Props>;
