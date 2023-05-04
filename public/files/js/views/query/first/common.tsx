/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

import * as React from 'react';
import * as Kontext from '../../../types/kontext';
import * as S from './style';

interface AltCorpSuggestionProps {
    altCorp:string;
    onClose:()=>void;
    onSubmit:(useAltCorp:boolean)=>void;
}

export function init(he:Kontext.ComponentHelpers):{AltCorpSuggestion:React.FC<AltCorpSuggestionProps>} {

    const layoutViews = he.getLayoutViews();

    // -------- <AltCorpSuggestion /> ------------------------------------

    const AltCorpSuggestion:React.FC<AltCorpSuggestionProps> = ({altCorp, onClose, onSubmit}) => (
        <layoutViews.ModalOverlay onCloseKey={onClose}>
            <layoutViews.CloseableFrame onCloseClick={onClose} label={he.translate('query__altcorp_heading')}>
                <S.CutOffBox>
                    <div className="message">
                        <layoutViews.StatusIcon status="warning" />
                        <p>
                            {he.translate('query__altcorp_suggested_{alt_corpus}', {alt_corpus: altCorp})}
                        </p>
                    </div>
                    <p className="submit">
                        <button type='button' className='default-button' onClick={() => onSubmit(false)}>
                            {he.translate('query__search_anyway_btn')}
                        </button>

                        <button type='button' className='default-button' onClick={() => onSubmit(true)}>
                            {he.translate('query__search_in_{corpus}_btn', {corpus: altCorp})}
                        </button>
                    </p>
                </S.CutOffBox>
            </layoutViews.CloseableFrame>
        </layoutViews.ModalOverlay>
    );

    return {
        AltCorpSuggestion
    };
}