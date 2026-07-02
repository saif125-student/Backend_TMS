export async function runController(controller, reqOverrides = {}) {
    console.log('it started /......./');
    
  let statusCode = 200;
  let responseData = null;

  const req = {
    body: {},
    params: {},
    query: {},
    user: null,
    ...reqOverrides,
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },

    json(data) {
      responseData = data;
      return this;
    },

    send(data) {
      responseData = data;
      return this;
    },
  };

  const next = (error) => {
    if (error) {
      throw error;
    }
  };

  await controller(req, res, next);

return {
  statusCode,
  success: statusCode >= 200 && statusCode < 300,
  data: responseData?.data ?? responseData,
  message: responseData?.message || null,
};
}