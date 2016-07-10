const a = require("../../utils/asyncify");
const DuplicateNameError = require("../../errors/duplicate-name-error");
const queries = require("../../db/queries");

module.exports = {
    path: "/grocery-lists",

    middlewares: [
        "jwtAuth",
        "householdExtractor",
    ],

    deps: [
        "db",
        "logger",
    ],


    routes: [
        {
            method: "GET",
            path: "/",

            handler: a(function* (db, logger, ctx, next) {
                ctx.body = {
                    grocery_lists: yield queries.groceryLists.getAllByEmail(db, logger, [
                        ctx.state.token.userId,
                    ]),
                };
            }),
        },

        {
            method: "GET",
            path: "/:id",

            handler: a(function* (db, logger, ctx, next) {
                ctx.body = {
                    grocery_list: yield queries.groceryLists.getOne(db, logger, [
                        userId,
                        groceryListId,
                    ]),
                };
            }),
        },

        {
            method: "POST",
            path: "/",

            middlewares: [
                "jwtAuth",
                "jsonBodyParser",
            ],

            handler: a(function* (db, logger, ctx, next) {
                const userId = ctx.state.token.userId;
                const name = ctx.request.body.name;
                const householdId = ctx.state.household_id;

                try {
                    const groceryListId = yield queries.groceryLists.create(db, logger, [
                        userId,
                        name,
                        householdId,
                    ]);

                    if(!groceryListId){
                        ctx.throw(401, "User doesn't have access to this household");
                        return;
                    }

                    ctx.body = {
                        groceryListId,
                    };

                    void(queries.groceryLists.touchAccessLog(db, logger, [
                        groceryListId,
                    ]));

                } catch (e) {
                    if (e instanceof DuplicateNameError) {
                        ctx.throw(400, "Grocery list name must be unique");
                    } else {
                        throw e;
                    }
                }
            }),
        },
    ],
};
