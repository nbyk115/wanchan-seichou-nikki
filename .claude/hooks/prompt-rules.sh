#!/bin/bash
cat << 'JSONEOF'
{"additionalContext": "【毎ターン強制ルール】\n1. 外科的変更: 依頼の範囲を超えない。隣接物を勝手に直さない。差分を最小化。\n2. トークン効率: Edit直接変更 > Grep/Glob > Read行範囲指定。同じ検索を繰り返さない。\n3. セキュリティ: .env/credentials/secretの読み取り禁止。force push禁止。外部APIへのPOST/PUT/DELETEは承認必須。"}
JSONEOF
