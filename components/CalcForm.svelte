<script>
    let value = "";
    let data = {
        num1: 0,
        num2: 0,
    };
    async function callFunction() {
        console.log("calling function");

        const resp = await fetch("/api/calc", {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
            mode: "cors",
        });

        if (resp.ok) {
            const result = await resp.json();
            value = result.value;
        } else {
            value = "NaN";
        }
    }
</script>

<h1>Sum nums</h1>
<form on:submit|preventDefault={() => callFunction()}>
    <div class="row">
        <div class="col">
            <div class="form-floating">
                <input
                    type="number"
                    step="5"
                    max="100"
                    min="0"
                    id="num1"
                    placeholder="First Number"
                    bind:value={data.num1}
                    class="form-control"
                />
                <label for="num1">First Number</label>
            </div>
        </div>
        <div class="col">
            <div class="form-floating">
                <input
                    type="number"
                    step="1"
                    max="100"
                    min="0"
                    id="num2"
                    placeholder="Second Number"
                    bind:value={data.num2}
                    class="form-control"
                />
                <label for="num2">Second Number</label>
            </div>
        </div>
        <div class="col d-grid">
            <button type="submit" class="btn btn-primary">Add</button>
        </div>
    </div>
</form>
<h2 class="mt-3">Sum result: {value}</h2>
