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
function set_data(text, data) {
    data = '' + data;
    if (text.wholeText !== data)
        text.data = data;
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
	let h1;
	let t1;
	let form;
	let div5;
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
	let div4;
	let t9;
	let h2;
	let t10;
	let t11;
	let mounted;
	let dispose;

	return {
		c() {
			h1 = element("h1");
			h1.textContent = "Sum nums";
			t1 = space();
			form = element("form");
			div5 = element("div");
			div1 = element("div");
			div0 = element("div");
			input0 = element("input");
			t2 = space();
			label0 = element("label");
			label0.textContent = "First Number";
			t4 = space();
			div3 = element("div");
			div2 = element("div");
			input1 = element("input");
			t5 = space();
			label1 = element("label");
			label1.textContent = "Second Number";
			t7 = space();
			div4 = element("div");
			div4.innerHTML = `<button type="submit" class="btn btn-primary">Add</button>`;
			t9 = space();
			h2 = element("h2");
			t10 = text("Sum result: ");
			t11 = text(/*value*/ ctx[0]);
			attr(input0, "type", "number");
			attr(input0, "step", "5");
			attr(input0, "max", "100");
			attr(input0, "min", "0");
			attr(input0, "id", "num1");
			attr(input0, "placeholder", "First Number");
			attr(input0, "class", "form-control");
			attr(label0, "for", "num1");
			attr(div0, "class", "form-floating");
			attr(div1, "class", "col");
			attr(input1, "type", "number");
			attr(input1, "step", "1");
			attr(input1, "max", "100");
			attr(input1, "min", "0");
			attr(input1, "id", "num2");
			attr(input1, "placeholder", "Second Number");
			attr(input1, "class", "form-control");
			attr(label1, "for", "num2");
			attr(div2, "class", "form-floating");
			attr(div3, "class", "col");
			attr(div4, "class", "col d-grid");
			attr(div5, "class", "row");
			attr(h2, "class", "mt-3");
		},
		m(target, anchor) {
			insert(target, h1, anchor);
			insert(target, t1, anchor);
			insert(target, form, anchor);
			append(form, div5);
			append(div5, div1);
			append(div1, div0);
			append(div0, input0);
			set_input_value(input0, /*data*/ ctx[1].num1);
			append(div0, t2);
			append(div0, label0);
			append(div5, t4);
			append(div5, div3);
			append(div3, div2);
			append(div2, input1);
			set_input_value(input1, /*data*/ ctx[1].num2);
			append(div2, t5);
			append(div2, label1);
			append(div5, t7);
			append(div5, div4);
			insert(target, t9, anchor);
			insert(target, h2, anchor);
			append(h2, t10);
			append(h2, t11);

			if (!mounted) {
				dispose = [
					listen(input0, "input", /*input0_input_handler*/ ctx[3]),
					listen(input1, "input", /*input1_input_handler*/ ctx[4]),
					listen(form, "submit", prevent_default(/*submit_handler*/ ctx[5]))
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*data*/ 2 && to_number(input0.value) !== /*data*/ ctx[1].num1) {
				set_input_value(input0, /*data*/ ctx[1].num1);
			}

			if (dirty & /*data*/ 2 && to_number(input1.value) !== /*data*/ ctx[1].num2) {
				set_input_value(input1, /*data*/ ctx[1].num2);
			}

			if (dirty & /*value*/ 1) set_data(t11, /*value*/ ctx[0]);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(h1);
			if (detaching) detach(t1);
			if (detaching) detach(form);
			if (detaching) detach(t9);
			if (detaching) detach(h2);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let value = "";
	let data = { num1: 0, num2: 0 };

	async function callFunction() {
		console.log("calling function");

		const resp = await fetch("/api/calc", {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json"
			},
			body: JSON.stringify(data),
			mode: "cors"
		});

		if (resp.ok) {
			const result = await resp.json();
			$$invalidate(0, value = result.value);
		} else {
			$$invalidate(0, value = "NaN");
		}
	}

	function input0_input_handler() {
		data.num1 = to_number(this.value);
		$$invalidate(1, data);
	}

	function input1_input_handler() {
		data.num2 = to_number(this.value);
		$$invalidate(1, data);
	}

	const submit_handler = () => callFunction();

	return [
		value,
		data,
		callFunction,
		input0_input_handler,
		input1_input_handler,
		submit_handler
	];
}

class CalcForm extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export { CalcForm };
