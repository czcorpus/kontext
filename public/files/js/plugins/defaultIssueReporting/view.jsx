/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../../vendor.d.ts/react.d.ts" />

import * as React from "vendor/react";

export function init(dispatcher, he, reportingStore) {

    const layoutViews = he.getLayoutViews();

    // -------------- <SubmitButton /> -------------------------------------

    const SubmitButton = (props) => {

        const handleSubmitClick = () => {
            dispatcher.dispatch({
                actionType: 'ISSUE_REPORTING_SUBMIT_ISSUE',
                props: {}
            });
        };

        if (props.waitingForStore) {
            return <img src={he.createStaticUrl('img/ajax-loader-bar.gif') }
                            title={he.translate('global__loading')} />;

        } else {
            return (
                <button type="button" className="default-button"
                        onClick={handleSubmitClick}>
                    {he.translate('defaultIR__submit_btn')}
                </button>
            );
        }
    };

    // -------------- <IssueReportingForm /> -------------------------------------

    const IssueReportingForm = (props) => {

        const handleTextareaChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'ISSUE_REPORTING_UPDATE_ISSUE_BODY',
                props: {value: evt.target.value}
            });
        };

        return (
            <layoutViews.ModalOverlay onCloseKey={props.closeClickHandler}>
                <layoutViews.CloseableFrame onCloseClick={props.closeClickHandler}
                        label={he.translate('defaultIR__report_issue_heading')}>
                    <form>
                        <textarea rows="10" cols="60" onChange={handleTextareaChange}
                                value={props.value} />
                        <p>
                            <SubmitButton waitingForStore={props.waitingForStore} />
                        </p>
                    </form>
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    };

    // -------------- <IssueReportingWidget /> -------------------------------------

    class IssueReportingWidget extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchStoreState();
            this._storeChangeHandler = this._storeChangeHandler.bind(this);
            this._handleLinkClick = this._handleLinkClick.bind(this);
            this._closeClickHandler = this._closeClickHandler.bind(this);
        }

        _fetchStoreState() {
            return {
                formVisible: reportingStore.isActive(),
                issueBody: reportingStore.getIssueBody(),
                waitingForStore: reportingStore.isBusy()
            };
        }

        _storeChangeHandler() {
            this.setState(this._fetchStoreState());
        }

        _handleLinkClick() {
            dispatcher.dispatch({
                actionType: 'ISSUE_REPORTING_SET_VISIBILITY',
                props: {value: true}
            });
        }

        _closeClickHandler() {
            dispatcher.dispatch({
                actionType: 'ISSUE_REPORTING_SET_VISIBILITY',
                props: {value: false}
            });
        }

        componentDidMount() {
            reportingStore.addChangeListener(this._storeChangeHandler);
        }

        componentWillUnmount() {
            reportingStore.removeChangeListener(this._storeChangeHandler);
        }

        render() {
            return (
                <div>
                    <a onClick={this._handleLinkClick}>
                        {he.translate('defaultIR__report_issue_link')}
                    </a>
                    {this.state.formVisible ?
                        <IssueReportingForm closeClickHandler={this._closeClickHandler}
                            issueBody={this.state.issueBody}
                            waitingForStore={this.state.waitingForStore} /> :
                        null
                    }
                </div>
            );
        }

    }


    return {
        IssueReportingWidget: IssueReportingWidget
    };

}