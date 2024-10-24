/// <reference types="cypress" />


describe('Subcorpora', () => {

    beforeEach(() => {
        cy.actionLogin();
    });

    afterEach(() => {
        cy.closeMessages();
        cy.actionLogout();
    });

    const createSubcorpus = (name, description, texttypes) => {
        // open create subcorpus
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 4);

        // create subcorpus from text type
        cy.get('#subcorp-form-mount table.form .subcname input').type(name);
        if (!!description) {
            cy.get('#subcorp-form-mount table.form textarea').type(description);
        }
        texttypes.forEach(v => {
            cy.get('#subcorp-form-mount div.data-sel div.grid > div input[type=checkbox]').check(v);
        });
        cy.get('#subcorp-form-mount p.submit-buttons').contains('button', 'Create subcorpus').click();
    }

    const createSubcorpusDraft = (name, texttypes) => {
        // open concordance form
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 1);
        cy.url().should('include', '/query');

        // create subcorpus draft from text type
        cy.contains('h2 a', 'Restrict search').click();
        texttypes.forEach(v => {
            cy.get('.specify-text-types div.grid > div input[type=checkbox]').check(v);
        });
        cy.contains('a.util-button', 'Save as a subcorpus draft').click();
        cy.get('input[name=subcorpName]').type(name);

        cy.contains('button', 'Create draft').click();
    }

    const openProperties = (name) => {
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', name).should('have.length', 1).find('a.properties-subc').click();
    }

    const closeProperties = () => {
        cy.get('.closeable-frame .heading .control img').click();
    }

    const deleteSubcorpus = (name) => {
        openProperties(name);
        cy.get('.closeable-frame').contains('button', 'Delete').click();
        closeMessages('Subcorpus has been deleted');
    }

    const closeMessages = (message) => {
        cy.get('div.messages-mount').contains('div.message', message).should('have.length', 1).find('a.close-icon').click();
    }

    const checkSubcProperties = (structure, notStructure, name, description) => {
        cy.get('.closeable-frame').contains('button', 'Subcorpus structure').click();
        structure.forEach(v => {
            cy.get('.closeable-frame').get(`input[value=${v}]`).should('be.checked');
        });
        notStructure.forEach(v => {
            cy.get('.closeable-frame').get(`input[value=${v}]`).should('not.be.checked');
        });
        cy.get('.closeable-frame').contains('button', 'Name and public description').click();
        cy.get('.closeable-frame input').should('have.value', name);
        cy.get('.closeable-frame textarea').should('have.value', description);
    }

    it('tests empty subcorpora list', () => {
        // open my subcorpora list
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);

        // contains only heading row
        cy.get('#my-subcorpora-mount table.data tbody tr').should('have.length', 1);
    });

    it('creates and deletes subcorpus', () => {
        createSubcorpus('sus1', 'description', ['1']);

        // table contains `sus1` subcorpus
        cy.url().should('include', '/subcorpus/list');
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('sus1').should('have.length', 1);

        // check properties
        openProperties('sus1');
        checkSubcProperties(['1'], [], 'sus1', 'description');
        closeProperties();

        // check click redirects to query page
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('a', 'sus1').click();
        cy.url().should('include', '/query');

        // return to subcorp page
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);

        // delete subcorpus
        deleteSubcorpus('sus1');
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('sus1').should('have.length', 0);
        cy.get('#my-subcorpora-mount div.inputs input#inp_pattern').type('description');
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus1').should('have.length', 0);
    });

    it('creates subcorpus draft', () => {
        createSubcorpusDraft('sus3', ['1']);

        // still on query page
        cy.url().should('include', '/query');

        // check draft is on subc page
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus3').contains('td', 'draft').should('have.length', 1);

        // check properties
        openProperties('sus3');
        checkSubcProperties(['1'], [], 'sus3', '');
        closeProperties();

        deleteSubcorpus('sus3');
    });

    it('creates subcorpus from draft', () => {
        createSubcorpusDraft('sus5', ['1']);
        
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus5').contains('td', 'draft').should('have.length', 1);

        cy.get('#my-subcorpora-mount table.data tbody tr a').contains('sus5').click();
        cy.url().should('include', '/subcorpus/new');
        cy.get('#subcorp-form-mount p.submit-buttons button').contains('Create subcorpus').click();

        cy.url().should('include', '/subcorpus/list');
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus5').contains('td', 'draft').should('have.length', 0);
        // check properties
        openProperties('sus5');
        checkSubcProperties(['1'], [], 'sus5', '');
        closeProperties();

        cy.get('#my-subcorpora-mount table.data tbody tr a').contains('sus5').click();
        cy.url().should('include', '/query');

        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);
        deleteSubcorpus('sus5');
    });

    it('creates subcorpus from draft using properties window', () => {
        createSubcorpusDraft('sus6', ['1']);
        
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus6').contains('td', 'draft').should('have.length', 1);

        // create corpus from draft
        openProperties('sus6');
        cy.contains('button', 'Subcorpus structure').click();
        cy.contains('button', 'Create subcorpus').click();
        closeMessages('A new subcorpus is being created');
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus6').contains('td', 'draft').should('have.length', 0);

        // check properties
        openProperties('sus6');
        checkSubcProperties(['1'], [], 'sus6', '');
        closeProperties();

        cy.get('#my-subcorpora-mount table.data tbody tr a').contains('sus6').click();
        cy.url().should('include', '/query');

        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);
        deleteSubcorpus('sus6');
    });

    it('creates subcorpus, edits it and removes it', () => {
        createSubcorpus('sus7', 'some description', ['1']);

        // check values and edit draft in properties
        cy.url().should('include', '/subcorpus/list');

        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus7').should('have.length', 1);
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus7new').should('have.length', 0);

        openProperties('sus7');
        checkSubcProperties(['1'], [], 'sus7', 'some description');
        cy.get('.closeable-frame').contains('button', 'Name and public description').click();
        cy.get('.closeable-frame input[type=text]').clear().type('sus7new');
        cy.get('.closeable-frame textarea').clear().type('beautiful subcorpus');
        cy.get('.closeable-frame').contains('button', 'Update name and public description').click();
        closeMessages('Subcorpus description has been updated');
        closeProperties();

        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus7new').should('have.length', 1);
        cy.get('#my-subcorpora-mount div.inputs input#inp_pattern').type('beautiful');
        cy.wait(500); // searching is delayed
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus7new').contains('tr', 'Found in description').should('have.length', 1);

        openProperties('sus7new');
        checkSubcProperties(['1'], [], 'sus7new', 'beautiful subcorpus');
        closeProperties();

        deleteSubcorpus('sus7new');
    });

    it('creates subcorpus draft, edits it and removes it', () => {
        createSubcorpusDraft('sus8', ['1']);
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);

        // check values and edit draft in properties
        cy.url().should('include', '/subcorpus/list');
        openProperties('sus8');
        // first check structure, name and description
        checkSubcProperties(['1'], [], 'sus8', '');

        // edit name and description and check
        cy.get('.closeable-frame').contains('button', 'Name and public description').click();
        cy.get('.closeable-frame input[type=text]').clear().type('sus8new');
        cy.get('.closeable-frame textarea').clear().type('new description');
        cy.get('.closeable-frame').contains('button', 'Update name and public description').click();
        closeMessages('Subcorpus description has been updated');
        //open and close properties to reload data before check
        closeProperties();
        openProperties('sus8new')
        checkSubcProperties(['1'], [], 'sus8new', 'new description');
        closeProperties();

        deleteSubcorpus('sus8new');
    });

    it('tests archiving subcorpus', () => {
        createSubcorpus('sus9', 'description', ['1']);

        // table contains `sus9` subcorpus
        cy.url().should('include', '/subcorpus/list');
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus9').should('have.length', 1);

        // archive it
        openProperties('sus9');
        cy.get('.closeable-frame').contains('button', 'Archive').click();
        closeProperties();

        // check archived subcorpora
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('archived').should('have.length', 0);
        cy.get('#my-subcorpora-mount div.inputs input[type=checkbox]').check(); // show archived corpora
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('archived').should('have.length', 1);

        // restore archived subcorpus
        openProperties('sus9');
        cy.get('.closeable-frame').contains('button', 'Restore').click();
        closeProperties();
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('archived').should('have.length', 0);

        deleteSubcorpus('sus9');
    });

    it('tests reusing subcorpus', () => {
        createSubcorpus('sus10', 'description', ['1']);

        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus10').should('have.length', 1);
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus11').should('have.length', 0);

        openProperties('sus10');
        cy.get('.closeable-frame').contains('button', 'Subcorpus structure').click();
        cy.get('.closeable-frame input[type=checkbox]').check('maj');

        cy.window().then((p) => {
            cy.stub(p, 'prompt').returns('sus11');
            cy.get('.closeable-frame').contains('button', 'Save as').click();
        });
        closeMessages('A new subcorpus is being created');
        closeMessages('Subcorpus susanne/sus11 creation - done');

        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus10').should('have.length', 1);
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus11').should('have.length', 1);

        // check properties
        openProperties('sus11');
        checkSubcProperties(['1', 'maj'], [], 'sus11', 'description');
        closeProperties();

        deleteSubcorpus('sus10');
        cy.wait(500);
        deleteSubcorpus('sus11');
    });

    it('checks subcorp page size settings', () => {
        createSubcorpus('sus12', 'description', ['1']);
        createSubcorpus('sus13', 'description', ['1']);
        createSubcorpus('sus14', 'description', ['1']);

        // set subcorpus page size to 1
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 3);
        cy.get('#view-options-mount .FieldsetSubcList table input[type=text]').clear().type(1);
        cy.get('#view-options-mount div.buttons button').click();

        cy.reload()
        // subcorpus table has header row and one subcorpus row
        cy.get('#my-subcorpora-mount table.data tbody tr').should('have.length', 2);

        // set subcorpus page size to 10
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 3);
        cy.get('#view-options-mount .FieldsetSubcList table input[type=text]').clear().type(10);
        cy.get('#view-options-mount div.buttons button').click();

        cy.reload()
        cy.get('#my-subcorpora-mount table.data tbody tr').its('length').should('be.gt', 2);
    });

    it('removes all remaining subcorpora using checkboxes', () => {
        // open my subcorpora list
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);

        cy.get('#my-subcorpora-mount table.data tbody tr').its('length').should('be.gt', 1);
        cy.get('td input[type=checkbox]').check();
        cy.contains('button', 'Delete').click();
        cy.get('#my-subcorpora-mount table.data tbody tr').should('have.length', 1);
    });
});