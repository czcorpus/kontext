/// <reference types="cypress" />


describe('Subcorpora', () => {

    beforeEach(() => {
        cy.actionLogin();
    });

    afterEach(() => {
        cy.actionLogout();
    });

    it('tests empty subcorpora list', () => {
        // open my subcorpora list
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);

        // contains only heading row
        cy.get('#my-subcorpora-mount table.data tbody tr').should('have.length', 1);
    });

    it('creates two subcorpora', () => {
        // open create subcorpus
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 4);

        // create subcorpus from text type
        cy.get('#subcorp-form-mount table.form .subcname input').type('sus1');
        cy.get('#subcorp-form-mount div.data-sel div.grid div').eq(1).get('input[type=checkbox]').check('1');
        cy.get('#subcorp-form-mount button').last().click();

        // contains one subcorpus
        cy.get('#my-subcorpora-mount table.data tbody tr').should('have.length', 2);

        // open create subcorpus again
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 4);

        // create subcorpus from within
        cy.get('#subcorp-form-mount table.form .subcname input[type=text]').type('sus2');
        cy.get('#subcorp-form-mount ul.FreqFormSelector button').last().click();
        cy.get('#subcorp-form-mount div.data-sel table.WithinBuilder input[type=text]').type('n="2"');
        cy.get('#subcorp-form-mount button').last().click();

        // contains two subcorpora
        cy.get('#my-subcorpora-mount table.data tbody tr').should('have.length', 3);
    });

    it('checks subcorp page size settings', () => {
        // open my subcorpora list
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);

        // set subcorpus page size to 1
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 3);
        cy.get('#view-options-mount .FieldsetSubcList table input[type=text]').clear().type(1);
        cy.get('#view-options-mount div.buttons button').click();

        cy.reload()
        cy.get('#my-subcorpora-mount table.data tbody tr').should('have.length', 2);

        // set subcorpus page size to 10
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 3);
        cy.get('#view-options-mount .FieldsetSubcList table input[type=text]').clear().type(10);
        cy.get('#view-options-mount div.buttons button').click();

        cy.reload()
        cy.get('#my-subcorpora-mount table.data tbody tr').its('length').should('be.gt', 2);
    });

    it('removes all created subcorpora', () => {
        // open my subcorpora list
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);
        cy.get('#my-subcorpora-mount table.data tbody tr').its('length').should('be.gte', 1);
 
        // removes listed subcorpora
        cy.get('#my-subcorpora-mount table.data tbody tr a.properties-subc').each(_ => {
            cy.wait(100)
            cy.get('#my-subcorpora-mount table.data tbody tr a.properties-subc').first().click()
            cy.get('#my-subcorpora-mount .closeable-frame .contents .danger-button').click()
        });

        // subclist should be empty
        cy.get('#my-subcorpora-mount table.data tbody tr').its('length').should('be.gte', 1);
    });
});