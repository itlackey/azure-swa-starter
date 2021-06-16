(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.BloodPredictWeb = {}));
}(this, (function (exports) { 'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* components/CalcForm.svelte generated by Svelte v3.38.2 */

    function create_fragment(ctx) {
    	let form;
    	let h50;
    	let t1;
    	let div8;
    	let div1;
    	let div0;
    	let input0;
    	let t2;
    	let label0;
    	let t4;
    	let div3;
    	let div2;
    	let input1;
    	let t5;
    	let label1;
    	let t7;
    	let div5;
    	let div4;
    	let input2;
    	let t8;
    	let label2;
    	let t10;
    	let div7;
    	let div6;
    	let input3;
    	let t11;
    	let label3;
    	let t13;
    	let h51;
    	let t15;
    	let div9;
    	let label4;
    	let t17;
    	let input4;
    	let t18;
    	let h52;
    	let t20;
    	let button;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			form = element("form");
    			h50 = element("h5");
    			h50.textContent = "Primary Values";
    			t1 = space();
    			div8 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			input0 = element("input");
    			t2 = space();
    			label0 = element("label");
    			label0.textContent = "Percent Transfused";
    			t4 = space();
    			div3 = element("div");
    			div2 = element("div");
    			input1 = element("input");
    			t5 = space();
    			label1 = element("label");
    			label1.textContent = "PRHCT";
    			t7 = space();
    			div5 = element("div");
    			div4 = element("div");
    			input2 = element("input");
    			t8 = space();
    			label2 = element("label");
    			label2.textContent = "ASA";
    			t10 = space();
    			div7 = element("div");
    			div6 = element("div");
    			input3 = element("input");
    			t11 = space();
    			label3 = element("label");
    			label3.textContent = "Weight (lbs)";
    			t13 = space();
    			h51 = element("h5");
    			h51.textContent = "Preop Lab Values";
    			t15 = space();
    			div9 = element("div");
    			label4 = element("label");
    			label4.textContent = "Age";
    			t17 = space();
    			input4 = element("input");
    			t18 = space();
    			h52 = element("h5");
    			h52.textContent = "Patient demographics and comorbidities";
    			t20 = space();
    			button = element("button");
    			button.textContent = "Go";
    			attr(input0, "type", "number");
    			attr(input0, "step", "0.05");
    			attr(input0, "max", "1");
    			attr(input0, "min", "0");
    			attr(input0, "id", "percentTransfused");
    			attr(input0, "placeholder", "Perctange value");
    			attr(input0, "class", "form-control");
    			attr(label0, "for", "percentTransfused");
    			attr(div0, "class", "form-floating");
    			attr(div1, "class", "col");
    			attr(input1, "type", "number");
    			attr(input1, "class", "form-control");
    			attr(input1, "placeholder", "0");
    			attr(label1, "for", "PRHCT");
    			attr(div2, "class", "form-floating");
    			attr(div3, "class", "col");
    			attr(input2, "type", "number");
    			attr(input2, "class", "form-control");
    			attr(label2, "for", "ASA");
    			attr(div4, "class", "form-floating");
    			attr(div5, "class", "col");
    			attr(input3, "type", "number");
    			attr(input3, "class", "form-control");
    			attr(label3, "for", "weight");
    			attr(div6, "class", "form-floating");
    			attr(div7, "class", "col");
    			attr(div8, "class", "row");
    			attr(label4, "for", "age");
    			attr(input4, "type", "number");
    			attr(input4, "class", "form-control");
    			attr(div9, "class", "row g-3");
    			attr(button, "type", "submit");
    			attr(button, "class", "btn btn-primary");
    		},
    		m(target, anchor) {
    			insert(target, form, anchor);
    			append(form, h50);
    			append(form, t1);
    			append(form, div8);
    			append(div8, div1);
    			append(div1, div0);
    			append(div0, input0);
    			set_input_value(input0, /*data*/ ctx[0].percent_transfused);
    			append(div0, t2);
    			append(div0, label0);
    			append(div8, t4);
    			append(div8, div3);
    			append(div3, div2);
    			append(div2, input1);
    			set_input_value(input1, /*data*/ ctx[0].PRHCT);
    			append(div2, t5);
    			append(div2, label1);
    			append(div8, t7);
    			append(div8, div5);
    			append(div5, div4);
    			append(div4, input2);
    			set_input_value(input2, /*data*/ ctx[0].ASA);
    			append(div4, t8);
    			append(div4, label2);
    			append(div8, t10);
    			append(div8, div7);
    			append(div7, div6);
    			append(div6, input3);
    			set_input_value(input3, /*data*/ ctx[0].WEIGHT);
    			append(div6, t11);
    			append(div6, label3);
    			append(form, t13);
    			append(form, h51);
    			append(form, t15);
    			append(form, div9);
    			append(div9, label4);
    			append(div9, t17);
    			append(div9, input4);
    			set_input_value(input4, /*data*/ ctx[0].Age);
    			append(form, t18);
    			append(form, h52);
    			append(form, t20);
    			append(form, button);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", /*input0_input_handler*/ ctx[2]),
    					listen(input1, "input", /*input1_input_handler*/ ctx[3]),
    					listen(input2, "input", /*input2_input_handler*/ ctx[4]),
    					listen(input3, "input", /*input3_input_handler*/ ctx[5]),
    					listen(input4, "input", /*input4_input_handler*/ ctx[6]),
    					listen(form, "submit", prevent_default(/*submit_handler*/ ctx[7]))
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*data*/ 1 && to_number(input0.value) !== /*data*/ ctx[0].percent_transfused) {
    				set_input_value(input0, /*data*/ ctx[0].percent_transfused);
    			}

    			if (dirty & /*data*/ 1 && to_number(input1.value) !== /*data*/ ctx[0].PRHCT) {
    				set_input_value(input1, /*data*/ ctx[0].PRHCT);
    			}

    			if (dirty & /*data*/ 1 && to_number(input2.value) !== /*data*/ ctx[0].ASA) {
    				set_input_value(input2, /*data*/ ctx[0].ASA);
    			}

    			if (dirty & /*data*/ 1 && to_number(input3.value) !== /*data*/ ctx[0].WEIGHT) {
    				set_input_value(input3, /*data*/ ctx[0].WEIGHT);
    			}

    			if (dirty & /*data*/ 1 && to_number(input4.value) !== /*data*/ ctx[0].Age) {
    				set_input_value(input4, /*data*/ ctx[0].Age);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(form);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let data = {
    		// Most important variables
    		percent_transfused: 0.9, // historical transfusion % for surgery patient is having
    		PRHCT: 30, // Hematocrit in g/dL
    		ASA: 3, // ASA physical status
    		WEIGHT: 190, // Weight in lbs
    		// Preop laboratory values
    		PRPLATE: 100,
    		PRINR: 2,
    		PRPTT: 33,
    		PRCREAT: 1,
    		PRSODM: 140,
    		PRALBUM: 4,
    		PRBILI: 1,
    		// Patient demographics and comorbidities
    		Age: 70,
    		HEIGHT: NaN,
    		ELECTSURG: 1,
    		SEX: 1, // female = 1
    		HYPERMED: 1,
    		DIALYSIS: 0,
    		HXCHF: 0,
    		HXCOPD: 1,
    		DIABETES: 1,
    		SMOKE: 1
    	};

    	async function callFunction() {
    		console.log("calling function");

    		await fetch("https://httpbin.org/post", {
    			method: "POST",
    			headers: {
    				Accept: "application/json",
    				"Content-Type": "application/json"
    			},
    			body: JSON.stringify({ a: 1, b: "Textual content" })
    		});

    		await fetch("/api/predict", {
    			method: "POST",
    			headers: {
    				Accept: "application/json",
    				"Content-Type": "application/json"
    			},
    			body: JSON.stringify(data),
    			mode: "cors"
    		});
    	}

    	function input0_input_handler() {
    		data.percent_transfused = to_number(this.value);
    		$$invalidate(0, data);
    	}

    	function input1_input_handler() {
    		data.PRHCT = to_number(this.value);
    		$$invalidate(0, data);
    	}

    	function input2_input_handler() {
    		data.ASA = to_number(this.value);
    		$$invalidate(0, data);
    	}

    	function input3_input_handler() {
    		data.WEIGHT = to_number(this.value);
    		$$invalidate(0, data);
    	}

    	function input4_input_handler() {
    		data.Age = to_number(this.value);
    		$$invalidate(0, data);
    	}

    	const submit_handler = () => callFunction();

    	return [
    		data,
    		callFunction,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler,
    		input4_input_handler,
    		submit_handler
    	];
    }

    class CalcForm extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    exports.CalcForm = CalcForm;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
