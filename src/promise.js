const PENDING = "pending";
const FULFILLED = "fulfilled";
const REJECTED = "rejected";

class Promise {
  constructor(executor) {
    this.state = PENDING;
    this.onFulfilled = []; // 成功回调队列
    this.onRejected = []; // 失败回调队列

    const resolve = value => {
      if (this.state === PENDING) {
        this.state = FULFILLED;
        this.value = value;
        this.onFulfilled.forEach(fn => fn()); // PromiseA+ 2.2.6.1
      }
    };

    const reject = reason => {
      if (this.state === PENDING) {
        this.state = REJECTED;
        this.reason = reason;
        this.onRejected.forEach(fn => fn()); // PromiseA+ 2.2.6.1
      }
    };

    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }


  then(onFulfilled, onRejected) {
    // PromiseA+ 2.2.1 / PromiseA+ 2.2.5 / PromiseA+ 2.2.7.3 / PromiseA+ 2.2.7.4
    // 值穿透 promise.then().then().then(res => { console.log(res); })
    onFulfilled = typeof onFulfilled === "function" ? onFulfilled : value => value;
    onRejected = typeof onRejected === "function" ? onRejected : reason => { throw reason; };
    // PromiseA+ 2.2.7 返回一个新的 Promise
    let promise2 = new Promise((resolve, reject) => {
      if (this.state === FULFILLED) {
        // PromiseA+ 2.2.2
        // PromiseA+ 2.2.4 --- setTimeout 模拟异步任务（规范要求）
        setTimeout(() => {
          try {
            // PromiseA+ 2.2.7.1
            let x = onFulfilled(this.value);
            handlePromise(promise2, x, resolve, reject);
          } catch (e) {
            // PromiseA+ 2.2.7.2
            reject(e);
          }
        });
      } else if (this.state === REJECTED) {
        // PromiseA+ 2.2.3
        setTimeout(() => {
          try {
            let x = onRejected(this.reason);
            handlePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      } else if (this.state === PENDING) {
        this.onFulfilled.push(() => {
          setTimeout(() => {
            try {
              let x = onFulfilled(this.value);
              handlePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          });
        });
        this.onRejected.push(() => {
          setTimeout(() => {
            try {
              let x = onRejected(this.reason);
              handlePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          });
        });
      }
    });
    return promise2;
  }
}

function handlePromise(promise2, x, resolve, reject) {
  // PromiseA+ 2.3.1 promise2 是否等于x，判断是否将自己本身返回，抛出 TypeError 错误
  if (promise2 === x) {
    reject(new TypeError('Chaining cycle'));
  }
  // PromiseA+ 2.3.3
  if (x && typeof x === 'object' || typeof x === 'function') {
    let used; // PromiseA+ 2.3.3.3.3 控制 resolve 或 reject 只执行一次，多次调用没有任何作用（规范要求）
    try {
      // PromiseA+ 2.3.3.1
      let then = x.then;
      // 如果是函数，就认为它是返回新的 promise
      if (typeof then === 'function') {
        // PromiseA+ 2.3.3.1
        then.call(x, (y) => {
          if (used) return;
          used = true;
          handlePromise(promise2, y, resolve, reject);
        }, (r) => {
          // PromiseA+ 2.3.3.2
          if (used) return;
          used = true;
          reject(r);
        });
      } else {
        // PromiseA+ 2.3.3.4 x 是普通值，直接返回
        if (used) return;
        used = true;
        resolve(x);
      }
    } catch (e) {
      // PromiseA+ 2.3.3.2
      if (used) return;
      used = true;
      reject(e);
    }
  } else {
    // PromiseA+ 2.3.4 x 是普通值，直接返回
    resolve(x);
  }
}

// Promise/A+ 测试脚本 promises-aplus-tests 所需代码
Promise.defer = Promise.deferred = function () {
  let dfd = {};
  dfd.promise = new Promise((resolve, reject) => {
    dfd.resolve = resolve;
    dfd.reject = reject;
  });
  return dfd;
}

Promise.resolve = function (param) {
  if (param instanceof Promise) {
    return param;
  }
  return new Promise((resolve, reject) => {
    if (param && param.then && typeof param.then === 'function') {
      // 为保持与原生 Promise 对象执行顺序一致，模拟使用 setTimeout
      setTimeout(() => {
        param.then(resolve, reject);
      });
    } else {
      resolve(param);
    }
  });
}

Promise.reject = function (reason) {
  return new Promise((resolve, reject) => {
    reject(reason);
  });
}

Promise.all = function (promises) {
  return new Promise((resolve, reject) => {
    let index = 0;
    let result = [];
    if (promises.length === 0) {
      resolve(result);
    } else {
      function processValue(i, data) {
        result[i] = data;
        if (++index === promises.length) {
          resolve(result);
        }
      }
      for (let i = 0; i < promises.length; i++) {
        // promises[i] 可能为普通值，使用 Promise.resolve
        Promise.resolve(promises[i]).then((data) => {
          processValue(i, data);
        }, (err) => {
          reject(err);
          return;
        });
      }
    }
  });
}

Promise.allSettled = function (promises) {
  return new Promise((resolve, reject) => {
    let index = 0;
    let result = [];
    if (promises.length === 0) {
      resolve(result);
    } else {
      function processValue(i, data) {
        result[i] = data;
        if (++index === promises.length) {
          resolve(result);
        }
      }
      for (let i = 0; i < promises.length; i++) {
        //promises[i] 可能是普通值
        Promise.resolve(promises[i]).then((data) => {
          processValue(i, { status: 'fulfilled', value: data });
        }, (err) => {
          processValue(i, { status: 'rejected', reason: err })
        });
      }
    }
  });
}

Promise.race = function (promises) {
  return new Promise((resolve, reject) => {
    if (promises.length === 0) {
      return;
    } else {
      for (let i = 0; i < promises.length; i++) {
        // promises[i] 可能为普通值，使用 Promise.resolve
        Promise.resolve(promises[i]).then((data) => {
          resolve(data);
          return;
        }, (err) => {
          reject(err);
          return;
        });
      }
    }
  });
}

Promise.prototype.catch = function (onRejected) {
  return this.then(null, onRejected);
}

Promise.prototype.finally = function (callback) {
  return this.then((value) => {
    return Promise.resolve(callback()).then(() => {
      return value;
    });
  }, (err) => {
    return Promise.resolve(callback()).then(() => {
      throw err;
    });
  });
}

module.exports = Promise;