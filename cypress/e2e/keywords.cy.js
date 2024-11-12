/// <reference types="cypress" />


describe('Keywords', () => {

    before(() => {
        cy.actionLogin();

        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);
        // create test subcorpus if it does not exist
        cy.get('#my-subcorpora-mount table.data td').contains('a', 'sus-kwords').then(($el) => {
            if ($el.length === 0) {
                cy.hoverNthMenuItem(2);
                cy.clickMenuItem(2, 4);

                // create subcorpus from text type
                cy.get('#subcorp-form-mount table.form .subcname input').type('sus-kwords');
                cy.get('#subcorp-form-mount div.data-sel div.grid > div input[type=checkbox]').check('10');
                cy.get('#subcorp-form-mount p.submit-buttons').contains('button', 'Create subcorpus').click();
            }
        });

        cy.actionLogout();
    });

    beforeEach(() => {
        cy.actionLogin();

        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 4);
    });

    afterEach(() => {
        cy.closeMessages();
        cy.actionLogout();
    });

    it('tests creating keyword analysis', () => {
        cy.get('#keywords-form-mount .corp-sel select').eq(0).select('sus-kwords');
        cy.get('#keywords-form-mount div.buttons').contains('button', 'Search').click();

        cy.url({timeout: 30000}).should('include', '/keywords/result');
        cy.get('#keywords-result-mount table tbody tr').should('have.length', 5);
    });
});