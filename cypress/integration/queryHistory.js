/// <reference types="cypress" />


describe('Query History', () => {

    // fill in some history items
    before(() => {
        cy.actionLogin();
        
        // concordance query
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 1);
        cy.get('.simple-input').type('London');
        cy.get('.query .default-button').click().then(() => {
            
            // paradigmatic query
            cy.hoverNthMenuItem(1);
            cy.clickMenuItem(1, 2);
            cy.get('#pquery-form-mount .cql-input').eq(0).type('[word="e.*"]');
            cy.get('#pquery-form-mount .cql-input').eq(1).type('[tag="N.*"]');
            cy.get('#pquery-form-mount .submit').click().then(() => {
                
                // word list query
                cy.hoverNthMenuItem(1);
                cy.clickMenuItem(1, 3);
                cy.get('#wl-pattern-input').type('.*ining');
                cy.get('#wordlist-form-mount .default-button').click();
            });
        });

        cy.actionLogout();
    });

    beforeEach(() => {
        cy.actionLogin();
        
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 4);
    });

    it('tests supertype filter', () => {
        // test any supertype
        let history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.be.empty');
        history.should('contain.text', 'concordance');
        history.should('contain.text', 'word list');
        history.should('contain.text', 'paradigmatic query');

        // test concordance supertype
        cy.get('#query-history-mount fieldset label select').select('concordance');
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('contain.text', 'concordance');
        history.should('not.contain.text', 'paradigmatic query');
        history.should('not.contain.text', 'word list');

        // test paradigmatic query supertype
        cy.get('#query-history-mount fieldset label select').select('paradigmatic query');
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.contain.text', 'concordance');
        history.should('contain.text', 'paradigmatic query');
        history.should('not.contain.text', 'word list');

        // test word list supertype
        cy.get('#query-history-mount fieldset label select').select('word list');
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.contain.text', 'concordance');
        history.should('not.contain.text', 'paradigmatic query');
        history.should('contain.text', 'word list');
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
        cy.get('#query-history-mount .history-entries').should('not.be.empty');

        cy.get('#query-history-mount fieldset label').eq(2).click();
        cy.wait(1000);
        cy.get('#query-history-mount fieldset label').eq(2).click();
        cy.get('#query-history-mount .history-entries').should('be.empty');

    });

    it('tests remove history item', () => {
        cy.get('#query-history-mount img.close-icon').click();
        cy.get('#query-history-mount').should('be.empty');

        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 1);
        cy.get('.simple-input').type('general archive item');
        cy.get('.query .default-button').click();

        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 4);

        cy.get('#query-history-mount .history-entries').children().first().should('contain', 'general archive item');
        cy.get('#query-history-mount .history-entries').children().first().find('.tools img').click();
        cy.get('#query-history-mount .history-entries').children().first().find('.tools button').eq(0).click();
        cy.get('#query-history-mount .history-entries').children().first().should('not.contain', 'general archive item');
    });

});