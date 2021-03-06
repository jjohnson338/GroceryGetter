const DuplicateNameError = require("../../errors/duplicate-name-error");
const InvalidCategoryError = require("../../errors/invalid-category-error");
const InvalidGroceryListError = require("../../errors/invalid-grocery-list-error");
const InvalidGroceryListItemError = require("../../errors/invalid-grocery-list-item-error");
const InvalidQuantityTypeError = require("../../errors/invalid-quantity-type-error");
const queries = require("../../db/queries");
const transactions = require("../../db/transactions");

const cacheKeys = {
  getGroceryListsKey: (householdId) => {
    return `getGroceryListsHousehold${householdId}`;
  },
  getSingleGroceryListKey: (householdId, groceryListId) => {
    return `getSingleGroceryList${groceryListId}Household${householdId}`;
  },
  getGroceryListItemsKey: (householdId, groceryListId) => {
    return `getGroceryListItems${groceryListId}Household${householdId}`;
  },
};

module.exports = {
  path: "/grocery-lists",

  middlewares: [
    "authJwt",
    "extractHouseholdId",
    "extractUserId",
  ],

  services: [
    "cacher",
    "db",
    "logger",
    "messenger",
  ],

  routes: [
    {
      method: "get",
      path: "/",

      produces: [
        "application/json",
      ],

      responses: {
        200: {},
      },

      handler: (async function (ctx, next) {
        const { cacher, db, logger } = ctx.services;
        let response;
        const cacheKey = cacheKeys.getGroceryListsKey(ctx.state.householdId);
        const cachedResult = await cacher.get(cacheKey);
        if (cachedResult) {
          response = cachedResult;
        } else {
          //Go get fetch the grocery lists and cache them
          response = {
            "grocery_lists": await queries.groceryLists.getAll(db, logger, {
              householdId: ctx.state.householdId,
              userId: ctx.state.userId,
            }),
          };
          await cacher.set(cacheKey, response);
        }

        ctx.body = response;
      }),
    },

    {
      method: "get",
      path: "/:id",

      produces: [
        "application/json",
      ],

      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          type: "integer",
        },
      ],

      responses: {
        200: {},
        400: {},
      },

      handler: (async function (ctx, next) {
        const { cacher, db, logger } = ctx.services;

        if (!ctx.params.id || !ctx.params.id.match(/^\d+$/)) {
          ctx.throw(400, "Invalid or missing Grocery List id");
        } else {
          let response;
          const cacheKey = cacheKeys.getSingleGroceryListKey(ctx.state.householdId, ctx.params.id);
          const cachedResult = await cacher.get(cacheKey);
          if (cachedResult) {
            response = cachedResult;
          } else {
            response = {
              "grocery_list": await queries.groceryLists.getOne(db, logger, {
                householdId: ctx.state.householdId,
                userId: ctx.state.userId,
                groceryListId: ctx.params.id,
              }),
            };
            await cacher.set(cacheKey, response);
          }
          ctx.body = response;
        }
      }),
    },

    {
      method: "post",
      path: "/",

      middlewares: [
        "parseJsonBody",
      ],

      produces: [
        "application/json",
      ],

      parameters: [
        {
          name: "name",
          in: "body",
          required: true,
          type: "string",
        },
      ],

      responses: {
        200: {},
        400: {},
        401: {},
      },

      handler: (async function (ctx, next) {
        const { cacher, db, logger, messenger } = ctx.services;

        const userId = ctx.state.userId;
        const householdId = ctx.state.householdId;
        const name = ctx.request.body.name;

        try {
          const groceryListId = await queries.groceryLists.addOne(db, logger, {
            userId,
            groceryListName: name,
            householdId,
          });

          if (!groceryListId) {
            ctx.throw(401, "User doesn't have access to this household");
            return;
          }

          //Invalidate cache
          await cacher.del(cacheKeys.getGroceryListsKey(householdId));
          //Send message
          messenger.addMessage(`household:'${householdId}' new grocery list`);

          ctx.body = {
            "grocery_list_id": groceryListId,
          };

          await queries.groceryLists.touchAccessLog(db, logger, {
            groceryListId,
          });

        } catch (e) {
          if (e instanceof DuplicateNameError) {
            ctx.throw(400, "Grocery list name must be unique");
          } else {
            throw e;
          }
        }
      }),
    },

    {
      method: "get",
      path: "/:id/items",

      produces: [
        "application/json",
      ],

      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          type: "integer",
        },
      ],

      responses: {
        200: {},
        400: {},
      },

      handler: (async function (ctx, next) {
        const { cacher, db, logger } = ctx.services;

        if (!ctx.params.id || !ctx.params.id.match(/^\d+$/)) {
          ctx.throw(400, "Invalid or missing Grocery List id");
        } else {
          let response;
          const cacheKey = cacheKeys.getGroceryListItemsKey(ctx.state.householdId, ctx.params.id);
          const cachedResult = await cacher.get(cacheKey);
          if (cachedResult) {
            response = cachedResult;
          } else {
            response = {
              "grocery_list_items": await queries.groceryLists.items.getAll(db, logger, {
                householdId: ctx.state.householdId,
                userId: ctx.state.userId,
                groceryListId: ctx.params.id,
              }),
            };
            await cacher.set(cacheKey, response);
          }
          ctx.body = response;
        }
      }),

    },

    {
      method: "post",
      path: "/:id/item",

      middlewares: [
        "parseJsonBody",
      ],

      produces: [
        "application/json",
      ],

      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          type: "integer",
        },
        {
          name: "item_name",
          in: "body",
          required: true,
          type: "string",
        },
        {
          name: "category_id",
          in: "body",
          required: true,
          type: "integer",
        },
        {
          name: "quantity_type_id",
          in: "body",
          required: true,
          type: "integer",
        },
        {
          name: "quantity",
          in: "body",
          required: true,
          type: "number",
          format: "double",
        },
      ],

      responses: {
        200: {},
        400: {},
      },

      handler: (async function (ctx, next) {
        const { db, logger, cacher } = ctx.services;

        const userId = ctx.state.userId;
        const householdId = ctx.state.householdId;
        const groceryListId = ctx.params.id;
        const itemName = ctx.request.body.item_name;
        const categoryId = ctx.request.body.category_id;
        const quantityTypeId = ctx.request.body.quantity_type_id;
        const quantity = ctx.request.body.quantity;

        if (!groceryListId || !groceryListId.toString().match(/^\d+$/)) {
          ctx.throw(400, "Invalid or missing Grocery List id");
        } else if (!itemName) {
          ctx.throw(400, "Missing 'item_name'");
        } else if (!categoryId || !categoryId.toString().match(/^\d+$/)) {
          ctx.throw(400, "Invalid or missing 'category_id'");
        } else if (!quantityTypeId || !quantityTypeId.toString().match(/^\d+$/)) {
          ctx.throw(400, "Invalid or missing 'quantity_type_id'");
        } else if (!quantity || !quantity.toString().match(/^[+-]?\d+(\.\d+)?$/)) {
          ctx.throw(400, "Invalid or missing 'quantity'");
        } else {
          try { 
            ctx.body = {
              "grocery_list_item_id": await transactions.groceryLists.addItem(db, logger, {
                userId,
                householdId,
                groceryListId: parseInt(groceryListId),
                itemName,
                categoryId: parseInt(categoryId),
                quantityTypeId: parseInt(quantityTypeId),
                quantity,
              }),                   
            };

            //Cache the updated list
            const cacheKey = cacheKeys.getGroceryListItemsKey(ctx.state.householdId, ctx.params.id);
            const groceryListItems = {
              "grocery_list_items": await queries.groceryLists.items.getAll(db, logger, {
                householdId,
                userId,
                groceryListId: parseInt(groceryListId),
              }),
            };
            await cacher.set(cacheKey, groceryListItems);

            await queries.groceryLists.touchAccessLog(db, logger, {
              groceryListId,
            });

          } catch(e) {
            if (e instanceof InvalidCategoryError) {
              ctx.throw(400, "Invalid category");
            } else if (e instanceof InvalidGroceryListError) {
              ctx.throw(400, "Invalid grocery list");
            } else if (e instanceof InvalidQuantityTypeError) {
              ctx.throw(400, "Invalid quantity type");
            } else {
              throw e;
            }
          }
        }

      }),
    },

    {
      method: "put",
      path: "/:id/item",

      middlewares: [
        "parseJsonBody",
      ],

      produces: [
        "application/json",
      ],

      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          type: "integer",
        },
        {
          name: "item_id",
          in: "body",
          required: true,
          type: "integer",
        },
        {
          name: "item_name",
          in: "body",
          required: false,
          type: "string",
        },
        {
          name: "category_id",
          in: "body",
          required: false,
          type: "integer",
        },
        {
          name: "quantity_type_id",
          in: "body",
          required: false,
          type: "integer",
        },
        {
          name: "quantity",
          in: "body",
          required: false,
          type: "number",
          format: "double",
        },
        {
          name: "checked",
          in: "body",
          required: false,
          type: "bool",
        },
        {
          name: "purchased",
          in: "body",
          required: false,
          type: "bool",
        },
        {
          name: "unit_cost",
          in: "body",
          required: false,
          type: "number",
          format: "double",
        },
      ],

      responses: {
        200: {},
        400: {},
      },

      handler: (async function (ctx, next) {
        const { db, logger, cacher } = ctx.services;

        //Required
        const userId = ctx.state.userId;
        const householdId = ctx.state.householdId;
        const groceryListId = parseInt(ctx.params.id);
        const groceryListItemId = parseInt(ctx.request.body.item_id);

        //Not required
        const itemName = typeof(ctx.request.body.item_name) == "undefined" 
          ? null : ctx.request.body.item_name;
        const categoryId = typeof(ctx.request.body.category_id) == "undefined" 
          ? null : ctx.request.body.category_id;
        const quantityTypeId = typeof(ctx.request.body.quantity_type_id) == "undefined" 
          ? null : ctx.request.body.quantity_type_id;
        const quantity = typeof(ctx.request.body.quantity) == "undefined" 
          ? null : ctx.request.body.quantity;
        const checked = typeof(ctx.request.body.checked) == "undefined" 
          ? null : ctx.request.body.checked;
        const purchased = typeof(ctx.request.body.purchased) == "undefined" 
          ? null : ctx.request.body.purchased;
        const unitCost = typeof(ctx.request.body.unit_cost) == "undefined" 
          ? null : ctx.request.body.unit_cost;

        //Required
        if (!groceryListId || !groceryListId.toString().match(/^\d+$/)) {
          ctx.throw(400, "Invalid or missing Grocery List id");
        } else if (!groceryListItemId || !groceryListItemId.toString().match(/^\d+$/)) {
          ctx.throw(400, "Invalid or missing Grocery List Item id");
        } 

        //Not required
        if (typeof(itemName) == "string" && itemName.length == 0) {
          ctx.throw(400, "Invalid 'item_name' format");
        } 
        if (categoryId && !categoryId.toString().match(/^\d+$/)) {
          ctx.throw(400, "Invalid 'category_id' format");
        } 
        if (quantityTypeId && !quantityTypeId.toString().match(/^\d+$/)) {
          ctx.throw(400, "Invalid 'quantity_type_id' format");
        } 
        if (quantity && !quantity.toString().match(/^[+-]?\d+(\.\d+)?$/)) {
          ctx.throw(400, "Invalid 'quantity' format");
        } 
        if (unitCost && !unitCost.toString().match(/^[+-]?\d+(\.\d+)?$/)) {
          ctx.throw(400, "Invalid 'unit_cost' format");
        } 
        
        try { 
          ctx.body = {
            "item_updated": await transactions.groceryLists.updateItem(db, logger, {
              userId,
              householdId,
              groceryListId: parseInt(groceryListId),
              groceryListItemId: parseInt(groceryListItemId),
              itemName,
              categoryId: categoryId ? parseInt(categoryId) : categoryId,
              quantityTypeId: quantityTypeId ? parseInt(quantityTypeId) : quantityTypeId,
              quantity,
              checked,
              purchased,
              unitCost,
            }),                   
          };
          console.log("got here")
          console.log(ctx.body.item_updated);

          //Cache the updated list
          const cacheKey = cacheKeys.getGroceryListItemsKey(ctx.state.householdId, ctx.params.id);
          const groceryListItems = {
            "grocery_list_items": await queries.groceryLists.items.getAll(db, logger, {
              householdId,
              userId,
              groceryListId: parseInt(groceryListId),
            }),
          };
          await cacher.set(cacheKey, groceryListItems);

          await queries.groceryLists.touchAccessLog(db, logger, {
            groceryListId,
          });

        } catch(e) {
          if (e instanceof InvalidCategoryError) {
            ctx.throw(400, "Invalid category");
          } else if (e instanceof InvalidGroceryListError) {
            ctx.throw(400, "Invalid grocery list");
          } else if (e instanceof InvalidGroceryListItemError) {
            ctx.throw(400, "Invalid grocery list item");
          } else if (e instanceof InvalidQuantityTypeError) {
            ctx.throw(400, "Invalid quantity type");
          } else {
            throw e;
          }
        }

      }),
    },

    {
      method: "delete",
      path: "/:id/items/:itemId",

      middlewares: [
        "parseJsonBody",
      ],

      produces: [
        "application/json",
      ],

      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          type: "integer",
        },
        {
          name: "itemId",
          in: "path",
          required: true,
          type: "integer",
        },
      ],

      responses: {
        200: {},
        400: {},
      },

      handler: (async function (ctx, next) {
        const { db, logger } = ctx.services;

        const userId = ctx.state.userId;
        const groceryListId = ctx.params.id;
        const groceryListItemId = ctx.params.itemId;

        if (!groceryListId || !groceryListId.toString().match(/^\d+$/)) {
          ctx.throw(400, "Invalid or missing Grocery List id");
        } else if (!groceryListItemId || !groceryListItemId.toString().match(/^\d+$/)) {
          ctx.throw(400, "Invalid or missing Grocery List Item id");
        } else {
          const deletedCount = await queries.groceryLists.items.removeOne(db, logger, {
            userId,
            groceryListId,
            groceryListItemId,
          });

          ctx.status = deletedCount == 1 ? 200 : 400;

          await queries.groceryLists.touchAccessLog(db, logger, {
            groceryListId,
          });
        }
      }),
    },
  ],
};
