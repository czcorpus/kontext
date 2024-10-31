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
        cy.closeMessages();
        cy.closeHistory();
        cy.actionLogout();
    });

    it('tests opening and closing history', () => {
        cy.get('#query-history-mount').should('not.be.empty');
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        cy.get('#query-history-mount').should('be.empty');
        cy.get('#query-history-mount').contains('button', 'Quick search').click();
        cy.get('#query-history-mount').should('not.be.empty');
        cy.closeHistory();
        cy.get('#query-history-mount').should('be.empty');
        cy.openHistory();
    });

    it('tests supertype filter in quick search', () => {
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

    it('tests supertype filter in extended search', () => {
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        
        // test any supertype
        cy.get('#query-history-mount select').first().select('any');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        let history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.be.empty');
        history.should('contain.text', 'concordance');
        history.should('contain.text', 'word list');
        history.should('contain.text', 'paradigmatic query');
        history.should('contain.text', 'keywords');

        // test concordance supertype
        cy.get('#query-history-mount select').first().select('concordance');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.be.empty');
        history.should('contain.text', 'concordance');
        history.should('not.contain.text', 'word list');
        history.should('not.contain.text', 'paradigmatic query');
        history.should('not.contain.text', 'keywords');

        // test word list supertype
        cy.get('#query-history-mount select').first().select('word list');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.be.empty');
        history.should('not.contain.text', 'concordance');
        history.should('contain.text', 'word list');
        history.should('not.contain.text', 'paradigmatic query');
        history.should('not.contain.text', 'keywords');

        // test paradigmatic query supertype
        cy.get('#query-history-mount select').first().select('paradigmatic query');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.be.empty');
        history.should('not.contain.text', 'concordance');
        history.should('not.contain.text', 'word list');
        history.should('contain.text', 'paradigmatic query');
        history.should('not.contain.text', 'keywords');

        // test keywords supertype
        cy.get('#query-history-mount select').first().select('keywords');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.be.empty');
        history.should('not.contain.text', 'concordance');
        history.should('not.contain.text', 'word list');
        history.should('not.contain.text', 'paradigmatic query');
        history.should('contain.text', 'keywords');
    });

    it('tests archive filter in quick search', () => {
        // check nothing is archived
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

    it('tests archive filter in extended search', () => {
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        // check nothing is archived
        cy.get('#query-history-mount input').eq(0).type('first-archived-item');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries').should('be.empty');
        cy.get('#query-history-mount input').eq(0).clear();
        cy.get('#query-history-mount').contains('button', 'Search').click();

        // open tools and archive
        cy.get('#query-history-mount .history-entries').children().first().find('.tools img').click();
        cy.get('#query-history-mount .history-entries').children().first().find('.tools button').eq(1).click();
        cy.get('#query-history-mount .history-entries').children().first().find('.tools input[type="text"]').type('first-archived-item');
        cy.get('#query-history-mount .history-entries').children().first().find('.tools button').eq(1).click();

        // check there are archived items
        cy.get('#query-history-mount input').eq(0).type('first-archived-item');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount fieldset label').eq(2).click();
        cy.get('#query-history-mount .history-entries').should('not.be.empty');

        // open tools and dearchive
        cy.get('#query-history-mount .history-entries').children().first().find('.tools img').click();
        cy.get('#query-history-mount .history-entries').children().first().find('.tools button').eq(1).click();
        cy.get('#query-history-mount .history-entries').should('be.empty');
    });

    it('tests remove history item in quick and extended search', () => {
        // close history
        cy.closeHistory();

        // create new concordance query
        cy.get('.simple-input').type('history test query 1');
        cy.get('.query .default-button').click();
        cy.get('.query .default-button').should('be.visible');

        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 1);
        cy.url().should('contain', '/query?');

        cy.get('.simple-input').type('history test query 2');
        cy.get('.query .default-button').click();
        cy.get('.query .default-button').should('be.visible');

        cy.wait(5000); // wait for saving query to index

        // open history
        cy.openHistory();
        cy.get('#query-history-mount .history-entries').should('be.visible');

        // check quick search
        cy.get('#query-history-mount .history-entries').children().eq(1).should('contain.text', 'history test query 1');
        cy.get('#query-history-mount .history-entries').children().eq(0).should('contain.text', 'history test query 2');
        // check extended search
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries').children().eq(1).should('contain.text', 'history test query 1');
        cy.get('#query-history-mount .history-entries').children().eq(0).should('contain.text', 'history test query 2');

        // delete from quick search
        cy.get('#query-history-mount').contains('button', 'Quick search').click();        
        cy.get('#query-history-mount .history-entries').children().eq(1).find('.tools img').click();
        cy.get('#query-history-mount .history-entries').find('.tools button').eq(0).click();
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 1');
        cy.get('#query-history-mount .history-entries').should('contain.text', 'history test query 2');

        // delete from extended search
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 1');
        cy.get('#query-history-mount .history-entries').should('contain.text', 'history test query 2');
        cy.get('#query-history-mount .history-entries').children().eq(0).find('.tools img').click();
        cy.get('#query-history-mount .history-entries').find('.tools button').eq(0).click();
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 1');
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 2');

        // check extended search
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 1');
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 2');
        
        // check quick search
        cy.get('#query-history-mount').contains('button', 'Quick search').click();
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 1');
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 2');
    });

    it('tests exact match and substring search in extended search', () => {
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