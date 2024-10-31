/// <reference types="cypress" />


describe('Query History', () => {

    // fill in some history items
    before(() => {
        cy.actionLogin();

        // concordance query
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 1);
        cy.url().should('contain', '/query?');
        cy.get('.simple-input').type('London');
        cy.get('.query .default-button').click();
        cy.url().should('contain', '/view?');

        // paradigmatic query
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 2);
        cy.url().should('contain', '/pquery/index?');
        cy.get('#pquery-form-mount .cql-input').eq(0).type('[word="e.*"]');
        cy.get('#pquery-form-mount .cql-input').eq(1).type('[tag="N.*"]');
        cy.get('#pquery-form-mount .submit').click();
        cy.url().should('contain', '/pquery/result?');

        // word list query
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 3);
        cy.url().should('contain', '/wordlist/form?');
        cy.get('#wl-pattern-input').type('.*ining');
        cy.get('#wordlist-form-mount .default-button').click();
        cy.url().should('contain', '/wordlist/result?');
                    
        // keywords
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 4);
        cy.url().should('contain', '/keywords/form?');
        cy.get('#kw-pattern').clear().type('.*ing');
        cy.get('#keywords-form-mount .default-button').click();
        cy.url().should('contain', '/keywords/result?');
        
        cy.actionLogout();
    });

    beforeEach(() => {
        cy.actionLogin();

        // open query history modal from menu
        cy.hoverNthMenuItem(1);
        cy.openHistory();
    });

    afterEach(() => {
        cy.closeHistory();
        cy.closeMessages();
        cy.actionLogout();
    });

    it('tests opening and closing history', () => {
        cy.get('#query-history-mount').should('not.be.empty');
        cy.closeHistory();
        cy.get('#query-history-mount').should('be.empty');
        cy.openHistory();
    });

    it('tests supertype filter', () => {
        // test any supertype
        let history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.be.empty');
        history.should('contain.text', 'concordance');
        history.should('contain.text', 'word list');
        history.should('contain.text', 'paradigmatic query');
        history.should('contain.text', 'keywords');

        // test concordance supertype
        cy.get('#query-history-mount fieldset.basic select').select('concordance');
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('contain.text', 'concordance');
        history.should('not.contain.text', 'paradigmatic query');
        history.should('not.contain.text', 'word list');
        history.should('not.contain.text', 'keywords');

        // test paradigmatic query supertype
        cy.get('#query-history-mount fieldset.basic select').select('paradigmatic query');
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.contain.text', 'concordance');
        history.should('contain.text', 'paradigmatic query');
        history.should('not.contain.text', 'word list');
        history.should('not.contain.text', 'keywords');

        // test word list supertype
        cy.get('#query-history-mount fieldset.basic select').select('word list');
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.contain.text', 'concordance');
        history.should('not.contain.text', 'paradigmatic query');
        history.should('contain.text', 'word list');
        history.should('not.contain.text', 'keywords');

        // test keywords supertype
        cy.get('#query-history-mount fieldset.basic select').select('keywords');
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.contain.text', 'concordance');
        history.should('not.contain.text', 'paradigmatic query');
        history.should('not.contain.text', 'word list');
        history.should('contain.text', 'keywords');
    });

    it('tests archive filter', () => {
        // test any supertype
        cy.get('#query-history-mount fieldset label').eq(2).click();
        cy.get('#query-history-mount .history-entries').should('be.empty');
        cy.get('#query-history-mount fieldset label').eq(2).click();

        // open tools and archive
        cy.get('#query-history-mount .history-entries').children().first().find('.tools img').click();
        cy.get('#query-history-mount .history-entries').children().first().find('.tools button').eq(1).click();
        cy.get('#query-history-mount .history-entries').children().first().find('.tools input[type="text"]').type('first-archived-item');
        cy.get('#query-history-mount .history-entries').children().first().find('.tools button').eq(1).click();

        // check there are archived items
        cy.get('#query-history-mount fieldset label').eq(2).click();
        cy.get('#query-history-mount .history-entries').should('not.be.empty');

        // open tools and dearchive
        cy.get('#query-history-mount .history-entries').children().first().find('.tools img').click();
        cy.get('#query-history-mount .history-entries').children().first().find('.tools button').eq(1).click();
        cy.get('#query-history-mount .history-entries').should('be.empty');
    });

    it('tests remove history item', () => {
        // close history
        cy.closeHistory();

        // create new concordance query
        cy.get('.simple-input').type('general archive test query');
        cy.get('.query .default-button').click();
        cy.get('.query .default-button', {timeout: 5000}).should('be.visible');

        // open history
        cy.openHistory();

        // check item is in the list, remove it and check it is gone
        cy.get('#query-history-mount .history-entries', {timeout: 5000}).should('be.visible');
        cy.get('#query-history-mount .history-entries').children().first().should('contain', 'general archive test query');
        cy.get('#query-history-mount .history-entries').children().first().find('.tools img').click();
        cy.get('#query-history-mount .history-entries').children().first().find('.tools button').eq(0).click();
        cy.get('#query-history-mount .history-entries').children().first().should('not.contain', 'general archive test query');
    });

    it('tests exact match and substring search', () => {
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        
        cy.get('#query-history-mount select').last().select('Any part of a query (exact match)');
        cy.get('#query-history-mount input').last().clear().type('London');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount').should('not.contain.text', 'No data found.');

        cy.get('#query-history-mount input').last().clear().type('lond'); // TODO substring is case does not work
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount').should('contain.text', 'No data found.');

        cy.get('#query-history-mount select').last().select('Any part of a query (substring)');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount').should('not.contain.text', 'No data found.');
    });

});